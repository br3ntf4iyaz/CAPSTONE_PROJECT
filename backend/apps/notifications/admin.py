from django.contrib import admin

from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("title", "user", "notification_type", "is_read", "created_at", "read_at")
    list_filter = ("notification_type", "is_read")
    search_fields = ("title", "message", "user__email", "user__first_name", "user__last_name")
    date_hierarchy = "created_at"
    readonly_fields = ("created_at", "read_at")
