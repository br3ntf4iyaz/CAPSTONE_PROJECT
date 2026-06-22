from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import AuditLog, Document, Interest, Profile, Skill, User, UserInterest, UserSkill


class ProfileInline(admin.StackedInline):
    model = Profile
    can_delete = False
    verbose_name_plural = "Profile"


class UserSkillInline(admin.TabularInline):
    model = UserSkill
    extra = 1


class UserInterestInline(admin.TabularInline):
    model = UserInterest
    extra = 1


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ("email", "first_name", "last_name", "role", "is_active", "is_staff", "onboarding_complete", "date_joined")
    list_filter = ("role", "is_active", "is_staff", "onboarding_complete")
    search_fields = ("email", "first_name", "last_name")
    ordering = ("-date_joined",)
    date_hierarchy = "date_joined"
    readonly_fields = ("date_joined",)
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Personal Info", {"fields": ("first_name", "last_name", "avatar")}),
        ("Role & Status", {"fields": ("role", "is_active", "is_staff", "is_superuser", "onboarding_complete")}),
        ("Permissions", {"fields": ("groups", "user_permissions")}),
        ("Dates", {"fields": ("date_joined", "last_login")}),
    )
    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("email", "first_name", "last_name", "role", "password1", "password2"),
        }),
    )
    inlines = [UserSkillInline, UserInterestInline]


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "barangay", "municipality", "province", "gender", "sk_position", "organization", "updated_at")
    list_filter = ("gender", "province", "municipality")
    search_fields = ("user__email", "user__first_name", "user__last_name", "barangay", "municipality", "province", "organization", "lgu_name")
    readonly_fields = ("updated_at",)


@admin.register(Skill)
class SkillAdmin(admin.ModelAdmin):
    list_display = ("name",)
    search_fields = ("name",)


@admin.register(Interest)
class InterestAdmin(admin.ModelAdmin):
    list_display = ("name",)
    search_fields = ("name",)


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ("title", "user", "doc_type", "uploaded_at")
    list_filter = ("doc_type",)
    search_fields = ("title", "user__email", "user__first_name", "user__last_name")
    date_hierarchy = "uploaded_at"
    readonly_fields = ("uploaded_at",)


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("user", "action", "model_name", "object_id", "ip_address", "created_at")
    list_filter = ("model_name",)
    search_fields = ("user__email", "action", "model_name", "ip_address")
    date_hierarchy = "created_at"
    readonly_fields = ("user", "action", "model_name", "object_id", "details", "ip_address", "created_at")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
