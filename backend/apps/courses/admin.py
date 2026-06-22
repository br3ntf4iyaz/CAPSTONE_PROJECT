from django.contrib import admin

from .models import (
    Certificate,
    Course,
    CourseModule,
    Enrollment,
    Lesson,
    LessonProgress,
    QuizAttempt,
)


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ("title", "category", "instructor", "is_published", "is_featured", "is_active", "duration_hours", "created_at")
    list_filter = ("category", "is_published", "is_featured", "is_active")
    search_fields = ("title", "description", "slug", "instructor__email", "instructor__first_name", "instructor__last_name")
    prepopulated_fields = {"slug": ("title",)}
    date_hierarchy = "created_at"
    readonly_fields = ("created_at", "updated_at")


@admin.register(CourseModule)
class CourseModuleAdmin(admin.ModelAdmin):
    list_display = ("title", "course", "order", "created_at")
    list_filter = ("course",)
    search_fields = ("title", "course__title")
    ordering = ("course", "order")
    readonly_fields = ("created_at",)


@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    list_display = ("title", "module", "order", "duration_minutes", "created_at")
    list_filter = ("module__course",)
    search_fields = ("title", "module__title", "module__course__title")
    ordering = ("module", "order")
    readonly_fields = ("created_at",)


@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display = ("user", "course", "status", "progress_percent", "enrolled_at", "completed_at")
    list_filter = ("status", "course")
    search_fields = ("user__email", "user__first_name", "user__last_name", "course__title")
    date_hierarchy = "enrolled_at"
    readonly_fields = ("enrolled_at",)


@admin.register(LessonProgress)
class LessonProgressAdmin(admin.ModelAdmin):
    list_display = ("enrollment", "lesson", "completed", "completed_at")
    list_filter = ("completed",)
    search_fields = ("enrollment__user__email", "lesson__title")


@admin.register(QuizAttempt)
class QuizAttemptAdmin(admin.ModelAdmin):
    list_display = ("enrollment", "score", "max_score", "passed", "attempted_at")
    list_filter = ("passed",)
    search_fields = ("enrollment__user__email", "enrollment__course__title")
    date_hierarchy = "attempted_at"
    readonly_fields = ("attempted_at",)


@admin.register(Certificate)
class CertificateAdmin(admin.ModelAdmin):
    list_display = ("certificate_number", "enrollment", "issued_at")
    search_fields = ("certificate_number", "enrollment__user__email", "enrollment__course__title")
    date_hierarchy = "issued_at"
    readonly_fields = ("issued_at",)
