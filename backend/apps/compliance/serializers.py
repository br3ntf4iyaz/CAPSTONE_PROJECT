import bleach
from rest_framework import serializers

from .models import ComplianceRecord, ComplianceReport, SKMECompliance, SKDocumentSubmission, SKAssemblyRecord


class ComplianceRecordSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    recorded_by_name = serializers.SerializerMethodField()
    record_type_display = serializers.CharField(
        source='get_record_type_display', read_only=True
    )

    class Meta:
        model = ComplianceRecord
        fields = [
            'id',
            'user',
            'user_name',
            'record_type',
            'record_type_display',
            'value',
            'description',
            'reference_id',
            'recorded_at',
            'recorded_by',
            'recorded_by_name',
        ]
        read_only_fields = ['recorded_at', 'recorded_by']

    def get_user_name(self, obj):
        if obj.user:
            return getattr(obj.user, 'get_full_name', lambda: obj.user.email)() or obj.user.email
        return None

    def get_recorded_by_name(self, obj):
        if obj.recorded_by:
            return getattr(obj.recorded_by, 'get_full_name', lambda: obj.recorded_by.email)() or obj.recorded_by.email
        return None

    def validate_description(self, value):
        return bleach.clean(value, tags=[], strip=True)


class ComplianceReportSerializer(serializers.ModelSerializer):
    generated_by_name = serializers.SerializerMethodField()
    report_type_display = serializers.CharField(
        source='get_report_type_display', read_only=True
    )

    class Meta:
        model = ComplianceReport
        fields = [
            'id',
            'generated_by',
            'generated_by_name',
            'barangay',
            'date_from',
            'date_to',
            'data',
            'created_at',
            'report_type',
            'report_type_display',
        ]
        read_only_fields = ['generated_by', 'data', 'created_at']

    def get_generated_by_name(self, obj):
        if obj.generated_by:
            return getattr(obj.generated_by, 'get_full_name', lambda: obj.generated_by.email)() or obj.generated_by.email
        return None

    def validate_barangay(self, value):
        return bleach.clean(value, tags=[], strip=True)


class SKMEComplianceSerializer(serializers.ModelSerializer):
    barangay_display = serializers.CharField(source='get_barangay_display', read_only=True)

    class Meta:
        model = SKMECompliance
        fields = ['id', 'barangay', 'barangay_display', 'year', 'me1_ppa', 'me1_gap', 'me2_policies', 'updated_at']
        read_only_fields = ['id', 'barangay', 'barangay_display', 'year', 'updated_at']


class SKDocumentSubmissionSerializer(serializers.ModelSerializer):
    barangay_display = serializers.CharField(source='get_barangay_display', read_only=True)

    class Meta:
        model = SKDocumentSubmission
        fields = ['id', 'barangay', 'barangay_display', 'year', 'minutes_status', 'minutes_count', 'sk_directory_status', 'youth_org_list_status', 'updated_at']
        read_only_fields = ['id', 'barangay', 'barangay_display', 'year', 'updated_at']


class SKAssemblyRecordSerializer(serializers.ModelSerializer):
    barangay_display = serializers.CharField(source='get_barangay_display', read_only=True)

    class Meta:
        model = SKAssemblyRecord
        fields = ['id', 'barangay', 'barangay_display', 'year', 'kk_1st_sem', 'kk_2nd_sem', 'lnk', 'updated_at']
        read_only_fields = ['id', 'barangay', 'barangay_display', 'year', 'updated_at']
