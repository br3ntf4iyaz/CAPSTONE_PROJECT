import bleach
from rest_framework import serializers
from apps.accounts.uploads import IMAGE_EXTS, DOC_EXTS, check_upload

from .models import SKBarangay, SKFeedback, SKMember, SKRequirement, SKRequirementTemplate
from .states import counts_of, directory_states

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
# SKRequirementTemplate
# ---------------------------------------------------------------------------

class SKRequirementTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = SKRequirementTemplate
        fields = ['id', 'name', 'description', 'order']


# ---------------------------------------------------------------------------
# SKRequirement
# ---------------------------------------------------------------------------

class SKRequirementSerializer(serializers.ModelSerializer):
    requirement_type_display = serializers.CharField(
        source='get_requirement_type_display', read_only=True
    )
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    reviewed_by_email = serializers.EmailField(
        source='reviewed_by.email', read_only=True, default=None
    )

    class Meta:
        model = SKRequirement
        fields = [
            'id',
            'barangay',
            'requirement_type',
            'requirement_type_display',
            'status',
            'status_display',
            'file',
            'submitted_at',
            'due_date',
            'notes',
            'reviewed_by',
            'reviewed_by_email',
            'reviewed_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['submitted_at', 'reviewed_at', 'created_at', 'updated_at']

    def validate_file(self, value):
        return validate_pdf(value)

    def validate_notes(self, value):
        return sanitize(value)


# ---------------------------------------------------------------------------
# SKRequirement — Compact (embedded in list response)
# ---------------------------------------------------------------------------

class SKRequirementCompactSerializer(serializers.ModelSerializer):
    key = serializers.CharField(source='requirement_type')
    label = serializers.CharField(source='get_requirement_type_display', read_only=True)
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = SKRequirement
        fields = ['id', 'key', 'label', 'status', 'file_url', 'submitted_at']

    def get_file_url(self, obj):
        """Public. Only a document that LYDO verified AND published is linked, and only through the FPDPB file endpoint."""
        from apps.compliance.models import SKComplianceRecord
        rec = SKComplianceRecord.objects.filter(requirement=obj, status='published').order_by('-published_at').first()
        if rec is None:
            return None
        path = f'/api/compliance/fpdpb/files/{rec.pk}/'
        request = self.context.get('request')
        return request.build_absolute_uri(path) if request else path


# ---------------------------------------------------------------------------
# SKMember
# ---------------------------------------------------------------------------

# A barangay SK council has 10 seats: the Chairperson (kept on the barangay) plus these.
SEAT_LIMITS = {'kagawad': 7, 'secretary': 1, 'treasurer': 1}


class SKOfficialsMixin(serializers.Serializer):
    """Adds the full, ordered list of the 10 officials of one barangay (and only that barangay)."""

    chairperson_photo_url = serializers.SerializerMethodField()
    group_photo_url = serializers.SerializerMethodField()
    officials = serializers.SerializerMethodField()
    can_edit_officials = serializers.SerializerMethodField()

    def get_can_edit_officials(self, obj):
        """True for LYDO admins and for a verified SK of this barangay (used to show the Change picture buttons)."""
        from .views import can_manage_council_pictures
        request = self.context.get('request')
        return bool(request) and can_manage_council_pictures(request.user, obj)

    def _abs(self, f):
        if not f:
            return None
        request = self.context.get('request')
        return request.build_absolute_uri(f.url) if request else f.url

    def get_chairperson_photo_url(self, obj):
        return self._abs(obj.chairperson_photo)

    def get_group_photo_url(self, obj):
        return self._abs(obj.group_photo)

    def _socials(self, obj):
        """The social records of this barangay, by seat. The chairperson record counts only while the same person is chairperson."""
        from .social import public_social
        from .views import can_manage_council_pictures
        request = self.context.get('request')
        full = bool(request) and can_manage_council_pictures(request.user, obj)
        by_member, chair = {}, None
        for s in obj.socials.all():
            if s.is_chairperson:
                if ' '.join(s.official_name.lower().split()) == ' '.join((obj.sk_chairperson or '').lower().split()):
                    chair = s
            elif s.member_id:
                by_member[s.member_id] = s
        return (lambda m: public_social(by_member.get(m), full)), public_social(chair, full)

    def get_officials(self, obj):
        rank = {'kagawad': 1, 'secretary': 2, 'treasurer': 3}
        for_member, for_chair = self._socials(obj)
        out = [{
            'id': None,
            'key': 'chairperson',
            'name': obj.sk_chairperson or 'SK Chairperson',
            'position': 'chairperson',
            'position_display': 'SK Chairperson',
            'photo_url': self._abs(obj.chairperson_photo),
            'order': 0,
            'social': for_chair,
        }]
        for m in sorted(obj.members.all(), key=lambda m: (rank.get(m.position, 9), m.order, m.id)):
            out.append({
                'id': m.id,
                'key': f'member-{m.id}',
                'name': m.name,
                'position': m.position,
                'position_display': m.get_position_display(),
                'photo_url': self._abs(m.photo),
                'order': m.order,
                'social': for_member(m.id),
            })
        return out


class SKMemberAdminSerializer(serializers.ModelSerializer):
    """Admin: add / edit one SK Kagawad, Secretary or Treasurer of a barangay (with picture)."""

    photo = serializers.ImageField(write_only=True, required=False, allow_null=True)
    photo_url = serializers.SerializerMethodField()
    position_display = serializers.CharField(source='get_position_display', read_only=True)

    class Meta:
        model = SKMember
        fields = ['id', 'barangay', 'name', 'position', 'position_display', 'order', 'photo', 'photo_url']

    def get_photo_url(self, obj):
        if not obj.photo:
            return None
        request = self.context.get('request')
        return request.build_absolute_uri(obj.photo.url) if request else obj.photo.url

    def validate_name(self, value):
        value = bleach.clean(value or '', tags=[], strip=True).strip()
        if len(value) < 2:
            raise serializers.ValidationError('Enter the official\'s full name.')
        return value[:200]

    def validate_photo(self, value):
        if value is not None:
            check_upload(value, IMAGE_EXTS, 5 * 1024 * 1024, field=None)
        return value

    def validate(self, attrs):
        barangay = attrs.get('barangay') or getattr(self.instance, 'barangay', None)
        position = attrs.get('position') or getattr(self.instance, 'position', None)
        if barangay is not None and position:
            taken = SKMember.objects.filter(barangay=barangay, position=position)
            if self.instance is not None:
                taken = taken.exclude(pk=self.instance.pk)
            limit = SEAT_LIMITS.get(position, 0)
            if taken.count() >= limit:
                label = dict(SKMember.POSITION_CHOICES).get(position, position)
                raise serializers.ValidationError({
                    'position': f'{barangay.barangay_name} already has its {limit} {label}{"s" if limit > 1 else ""}. '
                                f'Edit or remove one first.'
                })
            if 'order' not in attrs and self.instance is None:
                used = set(taken.values_list('order', flat=True))
                attrs['order'] = next((n for n in range(1, limit + 1) if n not in used), limit)
        return attrs



class SKMemberSerializer(serializers.ModelSerializer):
    photo_url = serializers.SerializerMethodField()
    position_display = serializers.CharField(source='get_position_display', read_only=True)

    class Meta:
        model = SKMember
        fields = ['id', 'name', 'position', 'position_display', 'photo_url', 'order']

    def get_photo_url(self, obj):
        if obj.photo:
            request = self.context.get('request')
            return request.build_absolute_uri(obj.photo.url) if request else obj.photo.url
        return None


# ---------------------------------------------------------------------------
# SKBarangay — List
# ---------------------------------------------------------------------------

class SKStatesMixin:
    """The requirement rows and the counts shown for a barangay come from sk_requirements.states: the honest state of each one.
    A document counts as done ("submitted_count") only when LYDO verified it; an upload alone is "waiting for LYDO"."""

    def _rows(self, obj):
        cache = self.context.setdefault('sk_states', {})
        if obj.id not in cache:
            cache.update(directory_states([obj]))
        return cache[obj.id]

    def _public_rows(self, obj):
        request = self.context.get('request')
        out = []
        for r in self._rows(obj):
            url = None
            if r.get('published_record_id'):
                path = f"/api/compliance/fpdpb/files/{r['published_record_id']}/"
                url = request.build_absolute_uri(path) if request else path
            out.append({'id': r['id'], 'key': r['key'], 'label': r['label'], 'status': r['status'], 'detail': r['detail'],
                        'remarks': r['remarks'], 'submitted_at': r['submitted_at'], 'monitored': r['monitored'], 'file_url': url})
        return out

    def get_total_requirements(self, obj):
        return counts_of(self._rows(obj))['total']

    def get_requirements_total(self, obj):
        return counts_of(self._rows(obj))['total']

    def get_submitted_count(self, obj):
        return counts_of(self._rows(obj))['submitted']

    def get_requirements_submitted(self, obj):
        return counts_of(self._rows(obj))['submitted']

    def get_pending_count(self, obj):
        return counts_of(self._rows(obj))['pending']

    def get_overdue_count(self, obj):
        return counts_of(self._rows(obj))['overdue']


class SKBarangayListSerializer(SKStatesMixin, SKOfficialsMixin, serializers.ModelSerializer):
    # Aliases expected by the admin frontend
    name = serializers.CharField(source='barangay_name')
    chairperson = serializers.CharField(source='sk_chairperson', allow_blank=True)
    requirements = serializers.SerializerMethodField()
    total_requirements = serializers.SerializerMethodField()
    requirements_total = serializers.SerializerMethodField()
    submitted_count = serializers.SerializerMethodField()
    requirements_submitted = serializers.SerializerMethodField()
    pending_count = serializers.SerializerMethodField()
    overdue_count = serializers.SerializerMethodField()
    logo_url = serializers.SerializerMethodField()
    members = SKMemberSerializer(many=True, read_only=True)

    def get_requirements(self, obj):
        return self._public_rows(obj)

    class Meta:
        model = SKBarangay
        fields = [
            'id',
            'name',
            'chairperson',
            'barangay_name',
            'sk_chairperson',
            'contact_email',
            'contact_phone',
            'address',
            'logo_url',
            'chairperson_photo_url',
            'group_photo_url',
            'officials',
            'can_edit_officials',
            'members',
            'is_active',
            'created_at',
            'requirements',
            'requirements_total',
            'requirements_submitted',
            'total_requirements',
            'submitted_count',
            'pending_count',
            'overdue_count',
        ]

    def get_logo_url(self, obj):
        if obj.logo:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.logo.url)
            return obj.logo.url
        return None


# ---------------------------------------------------------------------------
# SKBarangay — Detail
# ---------------------------------------------------------------------------

class SKBarangayDetailSerializer(SKStatesMixin, SKOfficialsMixin, serializers.ModelSerializer):
    submitted_count = serializers.SerializerMethodField()
    pending_count = serializers.SerializerMethodField()
    overdue_count = serializers.SerializerMethodField()
    requirements = serializers.SerializerMethodField()

    def get_requirements(self, obj):
        """Administrators get the full rows. Everyone else (the page is public) gets the compact rows: no notes, no reviewer, and a
        file link only for a document LYDO verified and published."""
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        full = bool(user and user.is_authenticated and getattr(user, 'role', '') in ('lgu_admin', 'super_admin'))
        if full:
            return SKRequirementSerializer(obj.requirements.all(), many=True, context=self.context).data
        return self._public_rows(obj)
    logo_url = serializers.SerializerMethodField()
    members = SKMemberSerializer(many=True, read_only=True)

    class Meta:
        model = SKBarangay
        fields = [
            'id',
            'barangay_name',
            'sk_chairperson',
            'contact_email',
            'contact_phone',
            'address',
            'description',
            'logo_url',
            'chairperson_photo_url',
            'group_photo_url',
            'officials',
            'can_edit_officials',
            'members',
            'is_active',
            'created_at',
            'requirements',
            'submitted_count',
            'pending_count',
            'overdue_count',
        ]
        read_only_fields = ['created_at']

    def get_logo_url(self, obj):
        if obj.logo:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.logo.url)
            return obj.logo.url
        return None

    def validate_description(self, value):
        return sanitize(value)


# ---------------------------------------------------------------------------
# SKFeedback
# ---------------------------------------------------------------------------

class SKFeedbackSerializer(serializers.ModelSerializer):
    submitter_name = serializers.SerializerMethodField()
    barangay_name = serializers.CharField(source='barangay.barangay_name', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = SKFeedback
        fields = [
            'id', 'barangay', 'barangay_name', 'category', 'category_display',
            'subject', 'message', 'rating', 'image_url', 'is_anonymous',
            'status', 'status_display', 'submitter_name', 'created_at',
        ]
        read_only_fields = ['id', 'created_at', 'barangay', 'submitted_by']

    def get_submitter_name(self, obj):
        if obj.is_anonymous:
            return 'Anonymous'
        if obj.submitted_by:
            return obj.submitted_by.get_full_name() or obj.submitted_by.email
        return 'Unknown'

    def get_image_url(self, obj):
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None
