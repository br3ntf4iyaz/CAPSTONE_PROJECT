from django.contrib import admin
from django.utils import timezone

from .models import Program, School, SchoolBookmark, SchoolComparison, SchoolProgram


class SchoolProgramInline(admin.TabularInline):
    model = SchoolProgram
    extra = 1
    fields = ("program", "verification_status", "source_url", "is_active", "notes")
    autocomplete_fields = ("program",)


@admin.register(School)
class SchoolAdmin(admin.ModelAdmin):
    list_display = ("name", "school_type", "municipality", "province", "is_active", "is_featured", "created_at")
    list_filter = ("school_type", "is_active", "is_featured", "province", "region")
    search_fields = ("name", "slug", "address", "municipality", "province", "region", "email")
    prepopulated_fields = {"slug": ("name",)}
    date_hierarchy = "created_at"
    readonly_fields = ("created_at", "updated_at")
    inlines = [SchoolProgramInline]


@admin.register(Program)
class ProgramAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "program_type", "field_of_study", "created_at")
    list_filter = ("program_type", "field_of_study")
    search_fields = ("name", "code", "description")
    readonly_fields = ("created_at",)


@admin.action(description="Mark selected programs as VERIFIED")
def mark_verified(modeladmin, request, queryset):
    queryset.update(verification_status="verified", verified_at=timezone.now())


@admin.action(description="Mark selected programs as PENDING verification")
def mark_pending(modeladmin, request, queryset):
    queryset.update(verification_status="pending", verified_at=None)


@admin.register(SchoolProgram)
class SchoolProgramAdmin(admin.ModelAdmin):
    list_display = ("school", "program", "verification_status", "is_active", "source_url")
    list_filter = ("verification_status", "is_active", "school__school_type", "school")
    search_fields = ("school__name", "program__name", "program__code")
    actions = [mark_verified, mark_pending]


@admin.register(SchoolBookmark)
class SchoolBookmarkAdmin(admin.ModelAdmin):
    list_display = ("user", "school", "bookmarked_at")
    list_filter = ("school",)
    search_fields = ("user__email", "user__first_name", "user__last_name", "school__name")
    date_hierarchy = "bookmarked_at"
    readonly_fields = ("bookmarked_at",)


@admin.register(SchoolComparison)
class SchoolComparisonAdmin(admin.ModelAdmin):
    list_display = ("user", "created_at", "updated_at")
    search_fields = ("user__email", "user__first_name", "user__last_name")
    date_hierarchy = "created_at"
    readonly_fields = ("created_at", "updated_at")
    filter_horizontal = ("schools",)
