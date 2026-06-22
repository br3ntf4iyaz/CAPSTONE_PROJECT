import bleach
from django.conf import settings
from rest_framework import serializers

from .models import (
    Certificate,
    Course,
    CourseModule,
    Enrollment,
    Lesson,
    LessonProgress,
    Question,
    QuestionChoice,
    QuizAttempt,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_ALLOWED_TAGS = [
    "a", "b", "blockquote", "br", "code", "em", "i", "li", "ol", "p",
    "pre", "strong", "u", "ul",
]


def _sanitize(value: str) -> str:
    """Strip unsafe HTML tags from rich-text input."""
    if not value:
        return value
    return bleach.clean(value, tags=_ALLOWED_TAGS, strip=True)


def _absolute_url(request, file_field):
    """Return absolute URL for a FileField / ImageField, or None."""
    if not file_field:
        return None
    url = file_field.url
    if request is not None:
        return request.build_absolute_uri(url)
    return url


def _validate_upload(value, max_mb=10, allowed_types=None):
    """Shared upload validator for file / image fields."""
    if value:
        max_bytes = max_mb * 1024 * 1024
        if value.size > max_bytes:
            raise serializers.ValidationError(
                f"File must not exceed {max_mb} MB."
            )
        if allowed_types and hasattr(value, "content_type"):
            if value.content_type not in allowed_types:
                raise serializers.ValidationError(
                    f"Unsupported file type. Allowed: {', '.join(allowed_types)}."
                )
    return value


# ---------------------------------------------------------------------------
# Instructor mini (read-only)
# ---------------------------------------------------------------------------

class InstructorMiniSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    full_name = serializers.CharField(read_only=True)
    email = serializers.EmailField(read_only=True)


# ---------------------------------------------------------------------------
# Lesson
# ---------------------------------------------------------------------------

class LessonSerializer(serializers.ModelSerializer):
    resource_file_url = serializers.SerializerMethodField()

    class Meta:
        model = Lesson
        fields = [
            "id",
            "title",
            "order",
            "content",
            "video_url",
            "resource_file_url",
            "resource_file",
            "duration_minutes",
            "created_at",
        ]
        read_only_fields = ["id", "created_at", "resource_file_url"]
        extra_kwargs = {
            "resource_file": {"write_only": True, "required": False},
        }

    def get_resource_file_url(self, obj):
        return _absolute_url(self.context.get("request"), obj.resource_file)

    def validate_content(self, value):
        return _sanitize(value)

    def validate_resource_file(self, value):
        allowed = [
            "application/pdf",
            "application/zip",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-powerpoint",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ]
        return _validate_upload(value, max_mb=10, allowed_types=allowed)


# ---------------------------------------------------------------------------
# CourseModule (with nested lessons)
# ---------------------------------------------------------------------------

class CourseModuleSerializer(serializers.ModelSerializer):
    lessons = LessonSerializer(many=True, read_only=True)

    class Meta:
        model = CourseModule
        fields = ["id", "title", "order", "description", "lessons", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate_description(self, value):
        return _sanitize(value)


# ---------------------------------------------------------------------------
# CourseMiniSerializer  (list view)
# ---------------------------------------------------------------------------

class CourseMiniSerializer(serializers.ModelSerializer):
    instructor_name = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()
    # Populated by annotation in the viewset queryset
    enrollment_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Course
        fields = [
            "id",
            "title",
            "slug",
            "category",
            "thumbnail_url",
            "duration_hours",
            "instructor_name",
            "enrollment_count",
            "price",
        ]

    def get_instructor_name(self, obj):
        if obj.instructor:
            return obj.instructor.full_name
        return None

    def get_thumbnail_url(self, obj):
        return _absolute_url(self.context.get("request"), obj.thumbnail)


# ---------------------------------------------------------------------------
# CourseDetailSerializer  (full detail + modules)
# ---------------------------------------------------------------------------

class CourseDetailSerializer(serializers.ModelSerializer):
    instructor = InstructorMiniSerializer(read_only=True)
    thumbnail_url = serializers.SerializerMethodField()
    modules = CourseModuleSerializer(many=True, read_only=True)
    enrollment_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Course
        fields = [
            "id",
            "title",
            "slug",
            "description",
            "category",
            "thumbnail_url",
            "thumbnail",
            "instructor",
            "is_published",
            "is_featured",
            "duration_hours",
            "is_active",
            "enrollment_count",
            "modules",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "slug",
            "created_at",
            "updated_at",
            "enrollment_count",
            "thumbnail_url",
            "instructor",
            "modules",
        ]
        extra_kwargs = {
            "thumbnail": {"write_only": True, "required": False},
        }

    def get_thumbnail_url(self, obj):
        return _absolute_url(self.context.get("request"), obj.thumbnail)

    def validate_description(self, value):
        return _sanitize(value)

    def validate_thumbnail(self, value):
        allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"]
        return _validate_upload(value, max_mb=10, allowed_types=allowed)


# ---------------------------------------------------------------------------
# EnrollmentSerializer
# ---------------------------------------------------------------------------

class EnrollmentSerializer(serializers.ModelSerializer):
    course = CourseMiniSerializer(read_only=True)
    course_id = serializers.PrimaryKeyRelatedField(
        queryset=Course.objects.filter(is_published=True, is_active=True),
        source="course",
        write_only=True,
    )
    user = serializers.HiddenField(default=serializers.CurrentUserDefault())

    class Meta:
        model = Enrollment
        fields = [
            "id",
            "user",
            "course",
            "course_id",
            "enrolled_at",
            "completed_at",
            "progress_percent",
            "status",
        ]
        read_only_fields = [
            "id",
            "enrolled_at",
            "completed_at",
            "progress_percent",
            "status",
        ]

    def validate(self, attrs):
        request = self.context.get("request")
        user = request.user if request else attrs.get("user")
        course = attrs.get("course")
        if Enrollment.objects.filter(user=user, course=course).exists():
            raise serializers.ValidationError(
                {"course_id": "You are already enrolled in this course."}
            )
        return attrs


# ---------------------------------------------------------------------------
# LessonProgressSerializer
# ---------------------------------------------------------------------------

class LessonProgressSerializer(serializers.ModelSerializer):
    class Meta:
        model = LessonProgress
        fields = ["id", "enrollment", "lesson", "completed", "completed_at"]
        read_only_fields = ["id", "completed_at"]


# ---------------------------------------------------------------------------
# CertificateSerializer
# ---------------------------------------------------------------------------

class CertificateSerializer(serializers.ModelSerializer):
    course_title = serializers.CharField(
        source="enrollment.course.title", read_only=True
    )
    course_id = serializers.IntegerField(
        source="enrollment.course.id", read_only=True
    )
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = Certificate
        fields = [
            "id",
            "certificate_number",
            "course_title",
            "course_id",
            "issued_at",
            "file_url",
        ]
        read_only_fields = ["id", "certificate_number", "issued_at"]

    def get_file_url(self, obj):
        return _absolute_url(self.context.get("request"), obj.file)


# ---------------------------------------------------------------------------
# QuizAttemptSerializer
# ---------------------------------------------------------------------------

class QuizAttemptSerializer(serializers.ModelSerializer):
    enrollment_id = serializers.PrimaryKeyRelatedField(
        queryset=Enrollment.objects.all(),
        source="enrollment",
    )

    class Meta:
        model = QuizAttempt
        fields = [
            "id",
            "enrollment_id",
            "score",
            "max_score",
            "passed",
            "attempted_at",
        ]
        read_only_fields = ["id", "attempted_at"]

    def validate(self, attrs):
        enrollment = attrs.get("enrollment")
        request = self.context.get("request")
        if request and enrollment and enrollment.user != request.user:
            raise serializers.ValidationError(
                {"enrollment_id": "You can only submit quiz attempts for your own enrollments."}
            )
        return attrs


# ---------------------------------------------------------------------------
# Quiz / Lesson detail serializers
# ---------------------------------------------------------------------------

class QuestionChoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionChoice
        fields = ['id', 'text', 'order']  # NEVER expose is_correct here (would let users cheat)


class QuestionSerializer(serializers.ModelSerializer):
    choices = QuestionChoiceSerializer(many=True, read_only=True)

    class Meta:
        model = Question
        fields = ['id', 'text', 'order', 'choices']


class LessonDetailSerializer(serializers.ModelSerializer):
    """Full lesson with questions — used in the player."""
    resource_file_url = serializers.SerializerMethodField()
    questions = QuestionSerializer(many=True, read_only=True)

    class Meta:
        model = Lesson
        fields = ['id', 'title', 'order', 'content', 'video_url', 'resource_file_url', 'duration_minutes', 'questions']

    def get_resource_file_url(self, obj):
        return _absolute_url(self.context.get('request'), obj.resource_file)


class QuizSubmitAnswerSerializer(serializers.Serializer):
    question_id = serializers.IntegerField()
    choice_id = serializers.IntegerField()


class QuizSubmitSerializer(serializers.Serializer):
    enrollment_id = serializers.IntegerField()
    lesson_id = serializers.IntegerField()
    answers = QuizSubmitAnswerSerializer(many=True)


class QuizResultAnswerSerializer(serializers.Serializer):
    question_id = serializers.IntegerField()
    question_text = serializers.CharField()
    selected_choice_id = serializers.IntegerField(allow_null=True)
    correct_choice_id = serializers.IntegerField(allow_null=True)
    is_correct = serializers.BooleanField()
    explanation = serializers.CharField(allow_null=True, allow_blank=True)


class QuizResultSerializer(serializers.Serializer):
    attempt_id = serializers.IntegerField()
    score = serializers.IntegerField()
    max_score = serializers.IntegerField()
    passed = serializers.BooleanField()
    percent = serializers.FloatField()
    answers = QuizResultAnswerSerializer(many=True)


class LessonProgressDetailSerializer(serializers.ModelSerializer):
    lesson_id = serializers.IntegerField(source='lesson.id')

    class Meta:
        model = LessonProgress
        fields = ['id', 'lesson_id', 'completed', 'completed_at']
