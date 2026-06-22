from django.contrib import admin
from .models import IDVerification


@admin.register(IDVerification)
class IDVerificationAdmin(admin.ModelAdmin):
    list_display  = ["user", "id_type", "status", "ai_verdict", "ai_confidence", "submitted_at"]
    list_filter   = ["status", "id_type", "ai_verdict"]
    search_fields = ["user__email", "user__first_name", "user__last_name"]
    readonly_fields = [
        "ai_verdict", "ai_confidence", "ai_notes",
        "ai_name_match", "ai_raw_response",
        "submitted_at", "updated_at",
    ]
    fieldsets = (
        ("Submission", {
            "fields": ("user", "id_type", "id_image", "status"),
        }),
        ("AI Analysis", {
            "fields": (
                "ai_verdict", "ai_confidence", "ai_notes",
                "ai_name_match", "ai_raw_response",
            ),
        }),
        ("Admin Review", {
            "fields": ("admin_notes", "reviewed_by", "reviewed_at"),
        }),
        ("Timestamps", {
            "fields": ("submitted_at", "updated_at"),
        }),
    )
