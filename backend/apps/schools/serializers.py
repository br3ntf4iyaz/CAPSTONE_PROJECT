import bleach
from rest_framework import serializers

from .models import Program, School, SchoolBookmark, SchoolComparison, SchoolProgram


class ProgramSerializer(serializers.ModelSerializer):
    class Meta:
        model = Program
        fields = ['id', 'name', 'code', 'description', 'program_type', 'created_at']

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
        ]

    def validate_admission_requirements(self, value):
        return bleach.clean(value, tags=[], strip=True)


class SchoolListSerializer(serializers.ModelSerializer):
    logo_url = serializers.SerializerMethodField()
    program_count = serializers.IntegerField(read_only=True)

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
        ]

    def get_logo_url(self, obj):
        request = self.context.get('request')
        if obj.logo and request:
            return request.build_absolute_uri(obj.logo.url)
        return None


class SchoolDetailSerializer(serializers.ModelSerializer):
    logo_url = serializers.SerializerMethodField()
    programs = serializers.SerializerMethodField()
    program_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = School
        fields = [
            'id',
            'name',
            'slug',
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
            'logo_url',
            'is_active',
            'is_featured',
            'created_at',
            'updated_at',
            'programs',
            'program_count',
        ]

    def get_logo_url(self, obj):
        request = self.context.get('request')
        if obj.logo and request:
            return request.build_absolute_uri(obj.logo.url)
        return None

    def get_programs(self, obj):
        qs = obj.school_programs.filter(is_active=True).select_related('program')
        return SchoolProgramSerializer(qs, many=True, context=self.context).data

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
            'is_active',
            'is_featured',
        ]

    def validate_description(self, value):
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
        return obj.school_programs.filter(is_active=True).count()

    def get_programs(self, obj):
        qs = obj.school_programs.filter(is_active=True).select_related('program')
        return SchoolProgramSerializer(qs, many=True, context=self.context).data


class SchoolComparisonSerializer(serializers.ModelSerializer):
    schools = SchoolMiniSerializer(many=True, read_only=True)

    class Meta:
        model = SchoolComparison
        fields = ['id', 'schools', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']
