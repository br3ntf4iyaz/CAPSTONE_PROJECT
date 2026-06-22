from django.contrib import admin

from .models import FAQ, SupportTicket, UserFeedback


@admin.register(SupportTicket)
class SupportTicketAdmin(admin.ModelAdmin):
    list_display = ("subject", "name", "email", "status", "priority", "assigned_to", "created_at", "resolved_at")
    list_filter = ("status", "priority")
    search_fields = ("subject", "message", "name", "email", "user__email", "assigned_to__email")
    date_hierarchy = "created_at"
    readonly_fields = ("created_at", "updated_at", "resolved_at")


@admin.register(FAQ)
class FAQAdmin(admin.ModelAdmin):
    list_display = ("question", "category", "order", "is_published", "created_at")
    list_filter = ("is_published", "category")
    search_fields = ("question", "answer", "category")
    ordering = ("order", "created_at")
    readonly_fields = ("created_at",)


@admin.register(UserFeedback)
class UserFeedbackAdmin(admin.ModelAdmin):
    list_display = ("user", "rating", "page", "submitted_at")
    list_filter = ("rating",)
    search_fields = ("user__email", "message", "page")
    date_hierarchy = "submitted_at"
    readonly_fields = ("submitted_at",)
