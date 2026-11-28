import bleach
from rest_framework import serializers

from .models import Program, School, SchoolBookmark, SchoolComparison, SchoolOffering, SchoolProgram


class ProgramSerializer(serializers.ModelSerializer):
    class Meta:
        model = Program
        fields = [
            'id', 'name', 'code', 'description', 'program_type', 'program_type_display',
            'field_of_study', 'field_of_study_display', 'created_at',
        ]

    program_type_display = serializers.CharField(source='get_program_type_display', read_only=True)
    field_of_study_display = serializers.CharField(source='get_field_of_study_display', read_only=True)

    def validate_name(self, value):
        return bleach.clean(value, tags=[], strip=True)

    def validate_description(self, value):
        return bleach.clean(value, tags=[], strip=True)


class SchoolProgramSerializer(serializers.ModelSerializer):
    program = ProgramSerializer(read_only=True)
    program_id = serializers.PrimaryKeyRelatedField(
        queryset=Program.objects.all(), source='program', write_only=True
    )

    class Meta:
        model = SchoolProgram
        fields = [
            'id',
            'program',
            'program_id',
            'is_active',
            'tuition_per_year',
            'scholarship_available',
            'admission_requirements',
            'verification_status',
            'source_url',
            'verified_at',
        ]

    def validate_admission_requirements(self, value):
        return bleach.clean(value, tags=[], strip=True)


class OfferingSerializer(serializers.ModelSerializer):
    class Meta:
        model = SchoolOffering
        fields = ['id', 'school', 'kind', 'name', 'code', 'note', 'verification_status', 'source_url', 'source_note', 'verified_at']
        read_only_fields = ['verified_at']

    def validate_name(self, value):
        return bleach.clean(value, tags=[], strip=True)

    def validate_note(self, value):
        return bleach.clean(value, tags=[], strip=True)


class SchoolOfferingsMixin:
    """Strands and TESDA qualifications are listed apart. Only verified ones are shown, and only to a signed-in user (like the courses)."""

    def _offerings(self, obj, kind):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not (user and user.is_authenticated):
            return []
        rows = [o for o in obj.offerings.all() if o.kind == kind and o.verification_status == 'verified']
        return [{'id': o.id, 'name': o.name, 'code': o.code, 'note': o.note, 'source_url': o.source_url, 'source_note': o.source_note} for o in rows]

    def get_strands(self, obj):
        return self._offerings(obj, 'strand')

    def get_tesda_programs(self, obj):
        return self._offerings(obj, 'tesda')

    def get_sector(self, obj):
        return obj.sector


class SchoolListSerializer(SchoolOfferingsMixin, serializers.ModelSerializer):
    strands = serializers.SerializerMethodField()
    tesda_programs = serializers.SerializerMethodField()
    sector = serializers.SerializerMethodField()
    logo_url = serializers.SerializerMethodField()
    program_count = serializers.IntegerField(read_only=True)
    programs_unavailable = serializers.SerializerMethodField()

    class Meta:
        model = School
        fields = [
            'id',
            'name',
            'slug',
            'school_type',
            'address',
            'municipality',
            'province',
            'logo_url',
            'program_count',
            'programs_unavailable',
            'source_url',
            'offers_college',
            'offers_senior_high',
            'barangay',
            'acronym',
            'offers_tvl',
            'tesda_provider',
            'offers_tvet',
            'shs_note',
            'info_status',
            'last_verified_at',
            'sector',
            'strands',
            'tesda_programs',
        ]

    def get_programs_unavailable(self, obj):
        return (getattr(obj, 'program_count', 0) or 0) == 0

    def get_logo_url(self, obj):
        request = self.context.get('request')
        if obj.logo and request:
            return request.build_absolute_uri(obj.logo.url)
        return None


class SchoolDetailSerializer(SchoolOfferingsMixin, serializers.ModelSerializer):
    strands = serializers.SerializerMethodField()
    tesda_programs = serializers.SerializerMethodField()
    sector = serializers.SerializerMethodField()
    logo_url = serializers.SerializerMethodField()
    programs = serializers.SerializerMethodField()
    program_count = serializers.IntegerField(read_only=True)
    programs_unavailable = serializers.SerializerMethodField()
    verification_note = serializers.SerializerMethodField()
    courses_locked = serializers.SerializerMethodField()

    class Meta:
        model = School
        fields = [
            'id',
            'name',
            'slug',
            'school_type',
            'source_url',
            'verification_note',
            'programs_unavailable',
            'description',
            'address',
            'municipality',
            'province',
            'region',
            'latitude',
            'longitude',
            'phone',
            'email',
            'website',
            'facebook_url',
            'logo_url',
            'is_active',
            'is_featured',
            'created_at',
            'updated_at',
            'programs',
            'program_count',
            'courses_locked',
            'offers_college',
            'offers_senior_high',
            'barangay',
            'acronym',
            'offers_tvl',
            'tesda_provider',
            'offers_tvet',
            'shs_note',
            'info_status',
            'last_verified_at',
            'sector',
            'strands',
            'tesda_programs',
        ]

    def get_logo_url(self, obj):
        request = self.context.get('request')
        if obj.logo and request:
            return request.build_absolute_uri(obj.logo.url)
        return None

    def _signed_in(self):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        return bool(user and user.is_authenticated)

    def get_courses_locked(self, obj):
        """True for a visitor: the school itself is public, the list of courses it offers needs an account."""
        return not self._signed_in()

    def _is_admin(self):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        return bool(user and user.is_authenticated and getattr(user, 'role', None) in ('lgu_admin', 'super_admin'))

    def get_programs(self, obj):
        if not self._signed_in():
            return []  # visitors see the school, not its courses
        qs = obj.school_programs.filter(is_active=True).select_related('program')
        request = self.context.get('request')
        include_all = self._is_admin() and request is not None and request.query_params.get('include_unverified') in ('1', 'true')
        if not include_all:
            qs = qs.filter(verification_status='verified')
        return SchoolProgramSerializer(qs, many=True, context=self.context).data

    def get_programs_unavailable(self, obj):
        return not obj.school_programs.filter(is_active=True, verification_status='verified').exists()

    def get_verification_note(self, obj):
        return obj.verification_note if self._is_admin() else ''

    def validate_description(self, value):
        return bleach.clean(value, tags=[], strip=True)


class SchoolWriteSerializer(serializers.ModelSerializer):
    """Used for create/update by super_admin."""

    class Meta:
        model = School
        fields = [
            'name',
            'school_type',
            'description',
            'address',
            'municipality',
            'province',
            'region',
            'latitude',
            'longitude',
            'phone',
            'email',
            'website',
            'facebook_url',
            'logo',
            'source_url',
            'verification_note',
            'is_active',
            'is_featured',
            'offers_college',
            'offers_senior_high',
            'barangay',
            'acronym',
            'offers_tvl',
            'tesda_provider',
            'offers_tvet',
            'shs_note',
            'info_status',
        ]

    def validate_description(self, value):
        return bleach.clean(value, tags=[], strip=True)

    def validate_shs_note(self, value):
        return bleach.clean(value, tags=[], strip=True)

    def validate_acronym(self, value):
        return bleach.clean(value, tags=[], strip=True)

    def validate_barangay(self, value):
        return bleach.clean(value, tags=[], strip=True)

    def validate_name(self, value):
        return bleach.clean(value, tags=[], strip=True)


class SchoolBookmarkSerializer(serializers.ModelSerializer):
    school = SchoolListSerializer(read_only=True)

    class Meta:
        model = SchoolBookmark
        fields = ['id', 'school', 'bookmarked_at']
        read_only_fields = ['bookmarked_at']


class SchoolMiniSerializer(serializers.ModelSerializer):
    """Compact school representation used inside SchoolComparisonSerializer."""

    logo_url = serializers.SerializerMethodField()
    program_count = serializers.SerializerMethodField()
    programs = serializers.SerializerMethodField()

    class Meta:
        model = School
        fields = [
            'id',
            'name',
            'slug',
            'school_type',
            'municipality',
            'province',
            'logo_url',
            'program_count',
            'programs',
        ]

    def get_logo_url(self, obj):
        request = self.context.get('request')
        if obj.logo and request:
            return request.build_absolute_uri(obj.logo.url)
        return None

    def get_program_count(self, obj):
        return obj.school_programs.filter(is_active=True, verification_status='verified').count()

    def get_programs(self, obj):
        qs = obj.school_programs.filter(is_active=True, verification_status='verified').select_related('program')
        return SchoolProgramSerializer(qs, many=True, context=self.context).data


class CourseSearchSerializer(serializers.ModelSerializer):
    """One verified program together with the school offering it."""

    name = serializers.CharField(source='program.name')
    description = serializers.CharField(source='program.description')
    program_type = serializers.CharField(source='program.program_type')
    program_type_display = serializers.CharField(source='program.get_program_type_display')
    field_of_study = serializers.CharField(source='program.field_of_study')
    field_of_study_display = serializers.CharField(source='program.get_field_of_study_display')
    school_id = serializers.IntegerField(source='school.id')
    school_name = serializers.CharField(source='school.name')
    school_type = serializers.CharField(source='school.school_type')

    class Meta:
        model = SchoolProgram
        fields = [
            'id', 'name', 'description', 'program_type', 'program_type_display',
            'field_of_study', 'field_of_study_display', 'school_id', 'school_name',
            'school_type', 'source_url', 'verification_status',
        ]


class AdminSchoolProgramSerializer(serializers.ModelSerializer):
    """Admin CRUD for the courses of a school (creates/reuses the shared Program by name)."""

    program = ProgramSerializer(read_only=True)
    name = serializers.CharField(write_only=True, required=False, max_length=255)
    program_type = serializers.ChoiceField(choices=Program.PROGRAM_TYPE_CHOICES, write_only=True, required=False)
    field_of_study = serializers.ChoiceField(choices=Program.FIELD_CHOICES, write_only=True, required=False)

    class Meta:
        model = SchoolProgram
        fields = [
            'id', 'school', 'program', 'name', 'program_type', 'field_of_study',
            'source_url', 'verification_status', 'verified_at', 'is_active', 'notes',
        ]
        read_only_fields = ['verified_at']
        validators = []

    def _program(self, validated, current=None):
        name = validated.pop('name', None)
        ptype = validated.pop('program_type', None)
        field = validated.pop('field_of_study', None)
        if name is None and ptype is None and field is None:
            return current
        name = bleach.clean(name or (current.name if current else ''), tags=[], strip=True)
        if not name:
            raise serializers.ValidationError({'name': 'Course name is required.'})
        prog, created = Program.objects.get_or_create(
            name=name,
            defaults={
                'program_type': ptype or (current.program_type if current else 'bachelor'),
                'field_of_study': field or (current.field_of_study if current else 'other'),
            },
        )
        if not created and (ptype or field):
            if ptype:
                prog.program_type = ptype
            if field:
                prog.field_of_study = field
            prog.save()
        return prog

    def validate(self, attrs):
        if self.instance is None and not attrs.get('name'):
            raise serializers.ValidationError({'name': 'Course name is required.'})
        if attrs.get('verification_status') == 'verified' and not (attrs.get('source_url') or (self.instance and self.instance.source_url)):
            raise serializers.ValidationError({'source_url': 'A source URL is required before a program can be marked verified.'})
        return attrs

    def create(self, validated):
        from django.utils import timezone
        program = self._program(validated)
        validated['program'] = program
        if validated.get('verification_status') == 'verified':
            validated['verified_at'] = timezone.now()
        obj, created = SchoolProgram.objects.update_or_create(
            school=validated.pop('school'), program=program, defaults=validated
        )
        return obj

    def update(self, instance, validated):
        from django.utils import timezone
        validated['program'] = self._program(validated, instance.program) or instance.program
        status = validated.get('verification_status')
        if status == 'verified' and instance.verification_status != 'verified':
            validated['verified_at'] = timezone.now()
        elif status == 'pending':
            validated['verified_at'] = None
        return super().update(instance, validated)


class SchoolComparisonSerializer(serializers.ModelSerializer):
    schools = SchoolMiniSerializer(many=True, read_only=True)

    class Meta:
        model = SchoolComparison
        fields = ['id', 'schools', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']
