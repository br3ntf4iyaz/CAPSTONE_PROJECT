from django.contrib import admin

from .models import Resource


@admin.register(Resource)
class ResourceAdmin(admin.ModelAdmin):
    list_display = ("title", "resource_type", "category", "uploaded_by", "is_published", "is_featured", "download_count", "created_at")
    list_filter = ("resource_type", "category", "is_published", "is_featured")
    search_fields = ("title", "description", "uploaded_by__email")
    date_hierarchy = "created_at"
    readonly_fields = ("created_at", "updated_at", "download_count")
