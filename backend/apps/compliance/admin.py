from django.contrib import admin

from .models import ComplianceRecord, ComplianceReport, SKMECompliance, SKDocumentSubmission, SKAssemblyRecord


@admin.register(ComplianceRecord)
class ComplianceRecordAdmin(admin.ModelAdmin):
    list_display = ("user", "record_type", "value", "description", "recorded_by", "recorded_at")
    list_filter = ("record_type",)
    search_fields = ("user__email", "user__first_name", "user__last_name", "description", "recorded_by__email")
    date_hierarchy = "recorded_at"
    readonly_fields = ("recorded_at",)


@admin.register(ComplianceReport)
class ComplianceReportAdmin(admin.ModelAdmin):
    list_display = ("report_type", "generated_by", "barangay", "date_from", "date_to", "created_at")
    list_filter = ("report_type",)
    search_fields = ("barangay", "generated_by__email")
    date_hierarchy = "created_at"
    readonly_fields = ("created_at",)


@admin.register(SKMECompliance)
class SKMEComplianceAdmin(admin.ModelAdmin):
    list_display = ("barangay", "year", "me1_ppa", "me1_gap", "me2_policies", "updated_at")
    list_filter = ("year", "me1_ppa", "me1_gap", "me2_policies")
    search_fields = ("barangay",)
    readonly_fields = ("updated_at",)


@admin.register(SKDocumentSubmission)
class SKDocumentSubmissionAdmin(admin.ModelAdmin):
    list_display = ("barangay", "year", "minutes_status", "minutes_count", "sk_directory_status", "youth_org_list_status", "updated_at")
    list_filter = ("year", "minutes_status", "sk_directory_status", "youth_org_list_status")
    search_fields = ("barangay",)
    readonly_fields = ("updated_at",)


@admin.register(SKAssemblyRecord)
class SKAssemblyRecordAdmin(admin.ModelAdmin):
    list_display = ("barangay", "year", "kk_1st_sem", "kk_2nd_sem", "lnk", "updated_at")
    list_filter = ("year", "kk_1st_sem", "kk_2nd_sem", "lnk")
    search_fields = ("barangay",)
    readonly_fields = ("updated_at",)
