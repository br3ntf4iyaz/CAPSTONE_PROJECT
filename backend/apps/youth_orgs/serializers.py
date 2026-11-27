import bleach
from rest_framework import serializers
from apps.accounts.uploads import IMAGE_EXTS, DOC_EXTS, check_upload

from . import officers as off
from .models import OrgAccomplishment, OrgMembershipApplication, OrgMembershipEvent, OrgRequirement, YouthOrganization

BLEACH_ALLOWED_TAGS = ['b', 'i', 'u', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li', 'a']
BLEACH_ALLOWED_ATTRS = {'a': ['href', 'title', 'rel']}

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


def sanitize(value):
    if isinstance(value, str):
        return bleach.clean(
            value,
            tags=BLEACH_ALLOWED_TAGS,
            attributes=BLEACH_ALLOWED_ATTRS,
            strip=True,
        )
    return value


def validate_pdf(file):
    """Validate that an uploaded file is a PDF and does not exceed 10 MB."""
    if file:
        if not file.name.lower().endswith('.pdf'):
            raise serializers.ValidationError('Only PDF files are accepted.')
        check_upload(file, {'.pdf'}, MAX_FILE_SIZE, field=None)
    return file


# ---------------------------------------------------------------------------
# OrgAccomplishment
# ---------------------------------------------------------------------------

class OrgAccomplishmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrgAccomplishment
        fields = ['id', 'organization', 'title', 'description', 'date_achieved', 'created_at']
        read_only_fields = ['created_at']

    def validate_title(self, value):
        return sanitize(value)

    def validate_description(self, value):
        return sanitize(value)


# ---------------------------------------------------------------------------
# OrgRequirement
# ---------------------------------------------------------------------------

class OrgRequirementSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrgRequirement
        fields = [
            'id', 'organization', 'name', 'is_submitted',
            'file', 'submitted_at', 'notes',
        ]
        read_only_fields = ['submitted_at']

    def validate_file(self, value):
        return validate_pdf(value)

    def validate_notes(self, value):
        return sanitize(value)


# ---------------------------------------------------------------------------
# YouthOrganization — List
# ---------------------------------------------------------------------------

class OrgListSerializer(serializers.ModelSerializer):
    logo_url = serializers.SerializerMethodField()
    requirements_total = serializers.SerializerMethodField()
    requirements_submitted = serializers.SerializerMethodField()
    has_officer_reviewer = serializers.SerializerMethodField()

    def get_has_officer_reviewer(self, obj):
        return obj.submitted_by_id is not None

    def get_requirements_total(self, obj):
        return len(obj.requirements.all())  # prefetched by the viewset

    def get_requirements_submitted(self, obj):
        return sum(1 for r in obj.requirements.all() if r.is_submitted)

    class Meta:
        model = YouthOrganization
        fields = [
            'id',
            'name',
            'classification',
            'sub_classification',
            'registration_category',
            'barangay',
            'description',
            'contact_person',
            'is_compliant',
            'accepting_members',
            'application_mode',
            'acronym',
            'registration_number',
            'has_officer_reviewer',
            'status',
            'created_at',
            'logo_url',
            'requirements_total',
            'requirements_submitted',
        ]

    def get_logo_url(self, obj):
        request = self.context.get('request')
        if obj.logo and request:
            return request.build_absolute_uri(obj.logo.url)
        return None


# ---------------------------------------------------------------------------
# YouthOrganization — Detail
# ---------------------------------------------------------------------------

class OrgDetailSerializer(serializers.ModelSerializer):
    logo_url = serializers.SerializerMethodField()
    accomplishments = OrgAccomplishmentSerializer(many=True, read_only=True)
    requirements = OrgRequirementSerializer(many=True, read_only=True)
    officers = serializers.SerializerMethodField()

    def get_officers(self, obj):
        return off.officers_for(obj, self.context.get('request'), True)

    facebook_url = serializers.CharField(required=False, allow_blank=True, max_length=300)  # checked and tidied in validate_facebook_url
    external_apply_url = serializers.CharField(required=False, allow_blank=True, max_length=300)  # http(s) only, checked in validate_external_apply_url
    source_url = serializers.CharField(required=False, allow_blank=True, max_length=400)  # http(s) only

    def get_logo_url(self, obj):
        request = self.context.get('request')
        if obj.logo and request:
            return request.build_absolute_uri(obj.logo.url)
        return None

    class Meta:
        model = YouthOrganization
        fields = [
            'id',
            'name',
            'classification',
            'sub_classification',
            'registration_category',
            'barangay',
            'description',
            'contact_person',
            'contact_email',
            'contact_phone',
            'logo',
            'logo_url',
            'mission',
            'membership_requirements',
            'how_to_join',
            'facebook_url',
            'accepting_members',
            'application_mode',
            'external_apply_url',
            'acronym',
            'registration_number',
            'registration_valid_until',
            'source_url',
            'is_active',
            'is_compliant',
            'status',
            'admin_notes',
            'created_at',
            'updated_at',
            'accomplishments',
            'requirements',
            'officers',
        ]
        read_only_fields = ['created_at', 'updated_at', 'is_compliant', 'status', 'admin_notes']

    def validate_facebook_url(self, value):
        from apps.sk_requirements.social import clean_facebook_url
        return clean_facebook_url(value, 'Facebook')

    def validate_external_apply_url(self, value):
        value = (value or '').strip()
        if not value:
            return ''
        from urllib.parse import urlparse
        import re
        if '://' not in value and re.match(r'^[A-Za-z][A-Za-z0-9+.-]*:(?!d)', value):
            raise serializers.ValidationError('Enter a web link that starts with http:// or https://.')
        u = urlparse(value if '://' in value else 'https://' + value)
        if u.scheme not in ('http', 'https') or not u.hostname or '.' not in u.hostname or ' ' in value:
            raise serializers.ValidationError('Enter a web link that starts with http:// or https://.')
        return u.geturl()

    def validate_source_url(self, value):
        return self.validate_external_apply_url(value)

    def validate_acronym(self, value):
        return sanitize(value)

    def validate_registration_number(self, value):
        return sanitize(value)

    def validate(self, attrs):
        mode = attrs.get('application_mode', getattr(self.instance, 'application_mode', 'in_app'))
        url = attrs.get('external_apply_url', getattr(self.instance, 'external_apply_url', ''))
        if mode == 'external' and not url:
            raise serializers.ValidationError({'external_apply_url': 'Add the link where people apply, or choose another way to apply.'})
        return attrs

    def validate_mission(self, value):
        return sanitize(value)

    def validate_membership_requirements(self, value):
        return sanitize(value)

    def validate_how_to_join(self, value):
        return sanitize(value)


class OrgOwnerSerializer(OrgDetailSerializer):
    """The leader's own organization (even before LYDO approves it): they edit the public profile, never the registration."""
    my_position = serializers.SerializerMethodField()

    def get_my_position(self, obj):
        request = self.context.get('request')
        row = obj.officers.filter(user=request.user).first() if request else None
        return off.OfficerSerializer(row, context=self.context).data['position_label'] if row else ''

    class Meta(OrgDetailSerializer.Meta):
        fields = [
            'id', 'name', 'acronym', 'classification', 'sub_classification', 'registration_category', 'registration_number',
            'registration_valid_until', 'barangay', 'status', 'admin_notes', 'is_active', 'created_at',
            'description', 'contact_person', 'contact_email', 'contact_phone', 'mission', 'membership_requirements', 'how_to_join',
            'facebook_url', 'accepting_members', 'application_mode', 'external_apply_url', 'officers', 'my_position',
        ]
        read_only_fields = ['id', 'name', 'classification', 'sub_classification', 'registration_category', 'registration_number',
                            'registration_valid_until', 'barangay', 'status', 'admin_notes', 'is_active', 'created_at', 'officers', 'my_position']

    def validate_description(self, value):
        return sanitize(value)


class OrgSubmissionSerializer(serializers.ModelSerializer):
    """Used by verified youth users to submit a new org registration."""

    requirements = serializers.SerializerMethodField()
    officers = serializers.SerializerMethodField()
    my_position = serializers.CharField(write_only=True, required=False, allow_blank=True)
    my_position_custom = serializers.CharField(write_only=True, required=False, allow_blank=True)
    officers_input = serializers.JSONField(write_only=True, required=False)

    class Meta:
        model = YouthOrganization
        fields = [
            'id', 'name', 'classification', 'sub_classification',
            'registration_category', 'barangay', 'description',
            'contact_person', 'contact_email', 'contact_phone',
            'status', 'admin_notes', 'created_at', 'requirements', 'officers',
            'my_position', 'my_position_custom', 'officers_input', 'accepting_members', 'application_mode', 'external_apply_url', 'acronym',
        ]
        read_only_fields = ['status', 'admin_notes', 'created_at', 'accepting_members', 'application_mode', 'external_apply_url', 'acronym']

    def get_officers(self, obj):
        return off.officers_for(obj, self.context.get('request'), True)

    def validate(self, attrs):
        # the officers of the new organization, with the leader's own position among them
        request = self.context.get('request')
        rows = attrs.get('officers_input') or []
        mine = (attrs.get('my_position') or '').strip()
        if mine:
            if not any(isinstance(r, dict) and r.get('is_me') for r in rows):
                rows = list(rows) + [{'position': mine, 'custom_title': attrs.get('my_position_custom', ''), 'name': (request.user.full_name or request.user.email), 'is_me': True}]
        attrs['_officer_rows'] = off.clean_officers(rows, sanitize)
        return attrs

    def create(self, validated_data):
        rows = validated_data.pop('_officer_rows', [])
        for k in ('my_position', 'my_position_custom', 'officers_input'):
            validated_data.pop(k, None)
        org = super().create(validated_data)
        request = self.context.get('request')
        if rows:
            off.save_officers(org, rows, request.user if request else None)
        return org

    def get_requirements(self, obj):
        # The owner's checklist: which documents are in and which are still missing.
        return [
            {
                'id': r.id, 'name': r.name, 'is_submitted': r.is_submitted,
                'submitted_at': r.submitted_at, 'notes': r.notes,
            }
            for r in obj.requirements.all()
        ]

    def get_logo_url(self, obj):
        request = self.context.get('request')
        if obj.logo and request:
            return request.build_absolute_uri(obj.logo.url)
        return None

    def validate_description(self, value):
        return sanitize(value)


# ---------------------------------------------------------------------------
# What the PUBLIC (visitors and ordinary accounts) may read. No admin notes, no uploaded documents, no review status.
# ---------------------------------------------------------------------------

class OrgPublicListSerializer(serializers.ModelSerializer):
    logo_url = serializers.SerializerMethodField()
    is_mine = serializers.SerializerMethodField()

    def get_is_mine(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        return bool(user and user.is_authenticated and obj.submitted_by_id == user.id)

    class Meta:
        model = YouthOrganization
        fields = [
            'id', 'name', 'classification', 'sub_classification', 'registration_category', 'barangay', 'description',
            'contact_person', 'is_compliant', 'accepting_members', 'logo_url', 'created_at',
            'application_mode', 'external_apply_url', 'acronym', 'is_mine',
        ]

    def get_logo_url(self, obj):
        request = self.context.get('request')
        return request.build_absolute_uri(obj.logo.url) if obj.logo and request else None


class OrgPublicDetailSerializer(OrgPublicListSerializer):
    accomplishments = OrgAccomplishmentSerializer(many=True, read_only=True)
    can_manage = serializers.SerializerMethodField()
    has_officer_reviewer = serializers.SerializerMethodField()
    officers = serializers.SerializerMethodField()

    class Meta(OrgPublicListSerializer.Meta):
        fields = OrgPublicListSerializer.Meta.fields + [
            'mission', 'membership_requirements', 'how_to_join', 'facebook_url', 'contact_email', 'contact_phone',
            'registration_number', 'registration_valid_until', 'source_url', 'has_officer_reviewer', 'officers',
            'accomplishments', 'can_manage',
        ]

    def get_officers(self, obj):
        # everyone sees the president, vice presidents, secretary and PRO; only the leader and LYDO see the rest
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        sees_all = bool(user and user.is_authenticated and (obj.submitted_by_id == user.id or getattr(user, 'role', '') in ('lgu_admin', 'super_admin')))
        return off.officers_for(obj, request, sees_all)

    def get_has_officer_reviewer(self, obj):
        # in-app applications are reviewed by the organization's own officers, when an officer account is linked to it
        return obj.submitted_by_id is not None

    def get_can_manage(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        return bool(user and user.is_authenticated and obj.submitted_by_id == user.id)


class OrgMembershipEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrgMembershipEvent
        fields = ['id', 'action', 'from_status', 'to_status', 'note', 'created_at']


class OrgMembershipApplicationSerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(source='organization.name', read_only=True)
    applicant_name = serializers.SerializerMethodField()
    applicant_email = serializers.EmailField(source='applicant.email', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    applicant_type = serializers.CharField(source='applicant.youth_type', read_only=True)
    reference_number = serializers.CharField(read_only=True)
    history = OrgMembershipEventSerializer(source='events', many=True, read_only=True)
    snapshot = serializers.SerializerMethodField()

    class Meta:
        model = OrgMembershipApplication
        fields = ['id', 'reference_number', 'organization', 'organization_name', 'applicant_name', 'applicant_email', 'message', 'status', 'status_display',
                  'decision_note', 'applicant_type', 'snapshot', 'privacy_consent_at', 'history', 'created_at', 'updated_at', 'decided_at']
        read_only_fields = fields

    def get_snapshot(self, obj):
        # the organization's leader sees who the person is, but not their phone number
        snap = dict(obj.snapshot or {})
        if not self.context.get('is_admin'):
            snap.pop('phone', None)
        return snap

    def get_applicant_name(self, obj):
        return obj.applicant.full_name or obj.applicant.email
