from django.contrib import admin

from .models import Program, School, SchoolBookmark, SchoolComparison, SchoolProgram


class SchoolProgramInline(admin.TabularInline):
    model = SchoolProgram
    extra = 1


@admin.register(School)
class SchoolAdmin(admin.ModelAdmin):
    list_display = ("name", "school_type", "municipality", "province", "region", "is_active", "is_featured", "created_at")
    list_filter = ("school_type", "is_active", "is_featured", "province", "region")
    search_fields = ("name", "slug", "address", "municipality", "province", "region", "email")
    prepopulated_fields = {"slug": ("name",)}
    date_hierarchy = "created_at"
    readonly_fields = ("created_at", "updated_at")
    inlines = [SchoolProgramInline]


@admin.register(Program)
class ProgramAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "program_type", "created_at")
    list_filter = ("program_type",)
    search_fields = ("name", "code", "description")
    readonly_fields = ("created_at",)


@admin.register(SchoolProgram)
class SchoolProgramAdmin(admin.ModelAdmin):
    list_display = ("school", "program", "is_active", "tuition_per_year", "scholarship_available")
    list_filter = ("is_active", "scholarship_available", "school", "program")
    search_fields = ("school__name", "program__name", "program__code")


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
