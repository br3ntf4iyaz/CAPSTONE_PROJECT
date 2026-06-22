from django.contrib import admin

from .models import Internship, InternshipApplication, InternshipRequirement


class InternshipRequirementInline(admin.TabularInline):
    model = InternshipRequirement
    extra = 1


@admin.register(Internship)
class InternshipAdmin(admin.ModelAdmin):
    list_display = ("title", "organization", "mode", "status", "is_featured", "is_active", "slots", "deadline", "created_at")
    list_filter = ("status", "mode", "is_featured", "is_active")
    search_fields = ("title", "organization", "description", "posted_by__email")
    date_hierarchy = "created_at"
    readonly_fields = ("created_at", "updated_at")
    inlines = [InternshipRequirementInline]


@admin.register(InternshipApplication)
class InternshipApplicationAdmin(admin.ModelAdmin):
    list_display = ("applicant", "internship", "status", "submitted_at", "updated_at", "interview_date")
    list_filter = ("status", "internship")
    search_fields = ("applicant__email", "applicant__first_name", "applicant__last_name", "internship__title")
    date_hierarchy = "submitted_at"
    readonly_fields = ("submitted_at", "updated_at")


@admin.register(InternshipRequirement)
class InternshipRequirementAdmin(admin.ModelAdmin):
    list_display = ("internship", "requirement")
    search_fields = ("requirement", "internship__title")
