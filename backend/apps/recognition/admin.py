from django.contrib import admin

from .models import Announcement, Badge, Certificate, LeaderboardEntry, UserBadge


@admin.register(Badge)
class BadgeAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "is_active", "created_at")
    list_filter = ("category", "is_active")
    search_fields = ("name", "description", "criteria")
    readonly_fields = ("created_at",)


@admin.register(UserBadge)
class UserBadgeAdmin(admin.ModelAdmin):
    list_display = ("user", "badge", "awarded_by", "earned_at")
    list_filter = ("badge",)
    search_fields = ("user__email", "user__first_name", "user__last_name", "badge__name", "awarded_by__email")
    date_hierarchy = "earned_at"
    readonly_fields = ("earned_at",)


@admin.register(Certificate)
class CertificateAdmin(admin.ModelAdmin):
    list_display = ("certificate_number", "title", "user", "issued_by", "issued_at", "expiry_date", "created_at")
    list_filter = ("issued_by",)
    search_fields = ("certificate_number", "title", "user__email", "user__first_name", "user__last_name", "issued_by")
    date_hierarchy = "issued_at"
    readonly_fields = ("created_at",)


@admin.register(LeaderboardEntry)
class LeaderboardEntryAdmin(admin.ModelAdmin):
    list_display = ("user", "rank", "total_score", "course_score", "governance_score", "project_score", "volunteer_score", "last_updated")
    search_fields = ("user__email", "user__first_name", "user__last_name")
    ordering = ("rank", "-total_score")
    readonly_fields = ("last_updated",)


@admin.register(Announcement)
class AnnouncementAdmin(admin.ModelAdmin):
    list_display = ("title", "created_by", "is_published", "published_at", "created_at")
    list_filter = ("is_published",)
    search_fields = ("title", "content", "created_by__email")
    date_hierarchy = "created_at"
    readonly_fields = ("created_at", "updated_at")
