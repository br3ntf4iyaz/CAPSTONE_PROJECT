import json
import re
from datetime import date

import bleach
from rest_framework import serializers

from apps.accounts.uploads import check_upload

from .documents import DOCUMENT_TYPES
from .models import ScholarshipApplication, ScholarshipApplicationDocument

MAX_DOC_BYTES = 5 * 1024 * 1024
UPLOAD_EXTS = {'.pdf', '.jpg', '.jpeg', '.png'}  # PDF, JPG and PNG only

# field -> (label, required, max_length)
PERSONAL_FIELDS = {
    'full_name': ('Complete name', True, 200), 'date_of_birth': ('Date of birth', True, 10),
    'age': ('Age', True, 3), 'gender': ('Gender', True, 40), 'civil_status': ('Civil status', True, 40),
    'nationality': ('Nationality', True, 60), 'email': ('Email address', True, 254),
    'contact_number': ('Contact number', True, 30), 'address': ('Complete residential address', True, 300),
    'barangay': ('Barangay', True, 100),
}
EDUCATION_FIELDS = {
    'level': ('Current educational level', True, 80), 'school_name': ('School name', True, 200),
    'school_address': ('School address', True, 300), 'course': ('Course or strand', True, 200),
    'year_level': ('Year level', True, 40), 'student_id': ('Student ID number', False, 60),
    'gwa': ('General weighted average', False, 10),
}
FAMILY_FIELDS = {
    'father_name': ("Father's name", False, 200), 'mother_name': ("Mother's name", False, 200),
    'guardian_name': ("Guardian's name", False, 200), 'parent_occupation': ('Parent/guardian occupation', True, 200),
    'monthly_income': ('Estimated monthly family income', True, 20), 'family_members': ('Number of family members', True, 3),
    'other_financial_info': ('Other financial information', False, 1000),
}


def _clean_section(raw, spec, errors, section, extra_required=()):
    if not isinstance(raw, dict):
        raw = {}
    out = {}
    for key, (label, required, maxlen) in spec.items():
        value = bleach.clean(str(raw.get(key) if raw.get(key) is not None else ''), tags=[], strip=True).strip()
        if (required or key in extra_required) and not value:
            errors.setdefault(section, {})[key] = f'{label} is required.'
            continue
        if len(value) > maxlen:
            errors.setdefault(section, {})[key] = f'{label} is too long.'
            continue
        out[key] = value
    return out


def parse_form_data(data, scholarship):
    """Validate the three form sections. Returns clean dicts or raises ValidationError with per-field messages."""
    errors = {}

    def load(name):
        raw = data.get(name)
        if isinstance(raw, str):
            try:
                return json.loads(raw or '{}')
            except ValueError:
                errors[name] = 'Invalid form data.'
                return {}
        return raw or {}

    personal = _clean_section(load('personal'), PERSONAL_FIELDS, errors, 'personal')
    education = _clean_section(load('education'), EDUCATION_FIELDS, errors, 'education',
                               extra_required=('gwa',) if scholarship.requires_gwa else ())
    family = _clean_section(load('family'), FAMILY_FIELDS, errors, 'family')

    def err(section, key, msg):
        errors.setdefault(section, {})[key] = msg

    if 'email' in personal and not re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', personal['email']):
        err('personal', 'email', 'Enter a valid email address.')
    if 'age' in personal and (not personal['age'].isdigit() or not (10 <= int(personal['age']) <= 100)):
        err('personal', 'age', 'Enter a valid age.')
    if 'date_of_birth' in personal:
        try:
            if date.fromisoformat(personal['date_of_birth']) >= date.today():
                raise ValueError
        except ValueError:
            err('personal', 'date_of_birth', 'Enter a valid date of birth.')
    if 'contact_number' in personal and not re.match(r'^[0-9+()\-\s]{7,30}$', personal['contact_number']):
        err('personal', 'contact_number', 'Enter a valid contact number.')
    if 'monthly_income' in family:
        try:
            if float(family['monthly_income'].replace(',', '')) < 0:
                raise ValueError
        except ValueError:
            err('family', 'monthly_income', 'Enter a valid amount.')
    if 'family_members' in family and (not family['family_members'].isdigit() or int(family['family_members']) < 1):
        err('family', 'family_members', 'Enter a valid number.')
    if education.get('gwa'):
        try:
            float(education['gwa'])
        except ValueError:
            err('education', 'gwa', 'Enter a valid number.')
    if family and not (family.get('father_name') or family.get('mother_name') or family.get('guardian_name')):
        err('family', 'father_name', "Enter at least one of the father's, mother's or guardian's name.")

    if errors:
        raise serializers.ValidationError(errors)
    return personal, education, family


def id_details(data):
    """The optional kind of ID the applicant picked, how the copy was made, and their confirmation. Raises when the choice is not valid."""
    from .documents import ID_TYPES
    id_type = str(data.get('valid_id_type', '') or '').strip()
    if id_type and id_type not in ID_TYPES:
        raise serializers.ValidationError({'documents': 'Choose one of the listed kinds of ID.'})
    other = bleach.clean(str(data.get('valid_id_other', '') or '').strip(), tags=[], strip=True)[:60]
    source = 'camera' if str(data.get('valid_id_source', '')).lower() == 'camera' else 'upload'
    confirmed = str(data.get('id_confirmed', '')).lower() in ('1', 'true', 'on')
    return {'id_type': id_type, 'id_type_other': other if id_type == 'other_gov' else '', 'source': source, 'confirmed': confirmed}


def collect_documents(files, allowed_keys):
    """Validate the uploaded files named doc_<type>. Returns [(doc_type, file)]."""
    out = []
    for name in files:
        if not name.startswith('doc_'):
            continue
        key = name[4:]
        if key not in DOCUMENT_TYPES:
            raise serializers.ValidationError({'documents': f'Unknown document type "{key}".'})
        if key not in allowed_keys:
            raise serializers.ValidationError({'documents': f'"{DOCUMENT_TYPES[key]}" is not part of this scholarship.'})
        for f in files.getlist(name):
            check_upload(f, UPLOAD_EXTS, MAX_DOC_BYTES, field='documents')
            out.append((key, f))
    return out


class DocumentSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    label = serializers.SerializerMethodField()

    class Meta:
        model = ScholarshipApplicationDocument
        fields = ['id', 'doc_type', 'label', 'original_name', 'url', 'uploaded_at', 'id_type', 'id_type_label', 'id_type_other', 'source',
                  'review_status', 'review_note', 'reviewed_at', 'superseded']

    id_type_label = serializers.SerializerMethodField()

    def get_id_type_label(self, obj):
        from .documents import ID_TYPES
        return ID_TYPES.get(obj.id_type, '')

    def get_label(self, obj):
        return DOCUMENT_TYPES.get(obj.doc_type, obj.doc_type)

    def get_url(self, obj):
        path = f'/api/applications/scholarship/{obj.application_id}/documents/{obj.pk}/'
        request = self.context.get('request')
        return request.build_absolute_uri(path) if request else path


class ScholarshipApplicationSerializer(serializers.ModelSerializer):
    documents = DocumentSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    applicant_email = serializers.CharField(source='applicant.email', read_only=True)
    applicant_type = serializers.CharField(source='applicant.youth_type', read_only=True)

    class Meta:
        model = ScholarshipApplication
        fields = [
            'id', 'reference_number', 'scholarship', 'scholarship_title', 'personal', 'education', 'family',
            'status', 'status_display', 'admin_remarks', 'applicant_message', 'documents', 'applicant_email', 'applicant_type',
            'submitted_at', 'updated_at', 'reviewed_at',
        ]
        read_only_fields = fields


class ScholarshipReviewSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=['submitted', 'under_review', 'for_compliance', 'approved', 'rejected'], required=False)
    admin_remarks = serializers.CharField(required=False, allow_blank=True, max_length=1500)

    def validate_admin_remarks(self, value):
        return bleach.clean(value, tags=[], strip=True).strip()
