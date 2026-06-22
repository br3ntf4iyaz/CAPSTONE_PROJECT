from django.contrib import admin

from .models import (
    Milestone,
    Project,
    ProjectComment,
    ProjectMember,
    ProjectResource,
    Task,
)


class ProjectMemberInline(admin.TabularInline):
    model = ProjectMember
    extra = 1


class MilestoneInline(admin.TabularInline):
    model = Milestone
    extra = 1


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ("title", "category", "status", "created_by", "is_public", "start_date", "end_date", "created_at")
    list_filter = ("status", "category", "is_public", "is_deleted")
    search_fields = ("title", "description", "slug", "created_by__email")
    prepopulated_fields = {"slug": ("title",)}
    date_hierarchy = "created_at"
    readonly_fields = ("created_at", "updated_at")
    inlines = [ProjectMemberInline, MilestoneInline]


@admin.register(ProjectMember)
class ProjectMemberAdmin(admin.ModelAdmin):
    list_display = ("user", "project", "role", "joined_at")
    list_filter = ("role", "project")
    search_fields = ("user__email", "user__first_name", "user__last_name", "project__title")
    readonly_fields = ("joined_at",)


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ("title", "project", "assigned_to", "status", "priority", "due_date", "created_at")
    list_filter = ("status", "priority", "project")
    search_fields = ("title", "description", "project__title", "assigned_to__email")
    date_hierarchy = "created_at"
    readonly_fields = ("created_at", "updated_at")


@admin.register(Milestone)
class MilestoneAdmin(admin.ModelAdmin):
    list_display = ("title", "project", "due_date", "completed", "completed_at", "created_at")
    list_filter = ("completed", "project")
    search_fields = ("title", "description", "project__title")
    date_hierarchy = "due_date"
    readonly_fields = ("created_at",)


@admin.register(ProjectResource)
class ProjectResourceAdmin(admin.ModelAdmin):
    list_display = ("title", "project", "uploaded_by", "uploaded_at")
    list_filter = ("project",)
    search_fields = ("title", "project__title", "uploaded_by__email")
    date_hierarchy = "uploaded_at"
    readonly_fields = ("uploaded_at",)


@admin.register(ProjectComment)
class ProjectCommentAdmin(admin.ModelAdmin):
    list_display = ("author", "project", "parent", "created_at", "updated_at")
    list_filter = ("project",)
    search_fields = ("author__email", "project__title", "content")
    date_hierarchy = "created_at"
    readonly_fields = ("created_at", "updated_at")
