import bleach
from django.conf import settings
from django.contrib.auth import get_user_model
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


VIDEO_EXTS = ('.mp4', '.webm', '.ogg', '.mov')
MAX_VIDEO_MB = 150


def _validate_video_file(value):
    import os
    if value:
        if os.path.splitext(value.name or '')[1].lower() not in VIDEO_EXTS:
            raise serializers.ValidationError('Upload an MP4, WebM, OGG or MOV video.')
        if value.size > MAX_VIDEO_MB * 1024 * 1024:
            raise serializers.ValidationError(f'The video must be under {MAX_VIDEO_MB} MB. For larger videos, use a video link.')
    return value


def _clean_outcomes(value):
    if not isinstance(value, list):
        raise serializers.ValidationError('Learning outcomes must be a list.')
    out = [bleach.clean(str(v), tags=[], strip=True).strip()[:200] for v in value if str(v).strip()]
    return out[:12]


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


class LessonOutlineSerializer(serializers.ModelSerializer):
    """What anyone may see about a lesson. The notes, the video and the questions are only served by the
    lesson endpoint, once the lesson is unlocked for that learner."""
    has_video = serializers.SerializerMethodField()

    class Meta:
        model = Lesson
        fields = ["id", "title", "order", "duration_minutes", "has_video"]

    def get_has_video(self, obj):
        return bool(obj.video_url or obj.video_file)


# ---------------------------------------------------------------------------
# CourseModule (with nested lessons)
# ---------------------------------------------------------------------------

class CourseModuleSerializer(serializers.ModelSerializer):
    lessons = LessonOutlineSerializer(many=True, read_only=True)

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
    audience_display = serializers.CharField(source="get_audience_display", read_only=True)
    total_lessons = serializers.SerializerMethodField()
    module_count = serializers.SerializerMethodField()
    # Populated by annotation in the viewset queryset
    enrollment_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Course
        fields = [
            "id",
            "title",
            "slug",
            "description",
            "category",
            "audience",
            "audience_display",
            "learning_outcomes",
            "passing_score",
            "thumbnail_url",
            "duration_hours",
            "instructor_name",
            "enrollment_count",
            "total_lessons",
            "module_count",
            "price",
        ]

    def get_total_lessons(self, obj):
        return sum(len(m.lessons.all()) for m in obj.modules.all())

    def get_module_count(self, obj):
        return len(obj.modules.all())

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
    instructor_id = serializers.PrimaryKeyRelatedField(
        queryset=get_user_model().objects.all(),
        source='instructor',
        write_only=True,
        allow_null=True,
        required=False,
    )
    thumbnail_url = serializers.SerializerMethodField()
    modules = CourseModuleSerializer(many=True, read_only=True)
    audience_display = serializers.CharField(source="get_audience_display", read_only=True)
    total_lessons = serializers.SerializerMethodField()
    enrollment_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Course
        fields = [
            "id",
            "title",
            "slug",
            "description",
            "category",
            "audience",
            "audience_display",
            "learning_outcomes",
            "passing_score",
            "certificate_statement",
            "total_lessons",
            "thumbnail_url",
            "thumbnail",
            "instructor",
            "instructor_id",
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

    def get_total_lessons(self, obj):
        return sum(len(m.lessons.all()) for m in obj.modules.all())

    def validate_learning_outcomes(self, value):
        return _clean_outcomes(value)

    def validate_certificate_statement(self, value):
        return bleach.clean(value or '', tags=[], strip=True)[:600]

    def validate_description(self, value):
        return _sanitize(value)

    def validate_thumbnail(self, value):
        allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"]
        return _validate_upload(value, max_mb=10, allowed_types=allowed)


def clean_certificate_name(value):
    """The name printed on the certificate: plain text, at least two letters, no digits-only or HTML."""
    import re
    name = re.sub(r"\s+", " ", bleach.clean(str(value or ''), tags=[], strip=True)).strip()
    if len(name) < 3:
        raise serializers.ValidationError('Please enter your complete name (at least 3 characters).')
    if not re.search(r"[^\W\d_]{2,}", name):
        raise serializers.ValidationError('The name must contain letters.')
    if len(name) > 150:
        raise serializers.ValidationError('The name is too long (150 characters at most).')
    return name


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
    total_lessons = serializers.SerializerMethodField()
    completed_lessons = serializers.SerializerMethodField()
    certificate_id = serializers.SerializerMethodField()
    learning_status = serializers.SerializerMethodField()
    current_lesson_id = serializers.SerializerMethodField()
    current_lesson_title = serializers.SerializerMethodField()
    certificate_name = serializers.CharField(max_length=150)

    class Meta:
        model = Enrollment
        fields = [
            "id",
            "user",
            "course",
            "course_id",
            "certificate_name",
            "enrolled_at",
            "completed_at",
            "progress_percent",
            "status",
            "total_lessons",
            "completed_lessons",
            "certificate_id",
            "learning_status",
            "current_lesson_id",
            "current_lesson_title",
        ]
        read_only_fields = [
            "id",
            "enrolled_at",
            "completed_at",
            "progress_percent",
            "status",
        ]

    def _counts(self, obj):
        cache = self.context.setdefault('_lesson_counts', {})
        if obj.pk not in cache:
            from . import progress
            total = Lesson.objects.filter(module__course=obj.course).count()
            done = len(progress.completed_lesson_ids(obj))
            cache[obj.pk] = (total, done)
        return cache[obj.pk]

    def get_total_lessons(self, obj):
        return self._counts(obj)[0]

    def get_completed_lessons(self, obj):
        return self._counts(obj)[1]

    def get_certificate_id(self, obj):
        cert = Certificate.objects.filter(enrollment=obj).only('id').first()
        return cert.id if cert else None

    def _current(self, obj):
        cache = self.context.setdefault('_current_lessons', {})
        if obj.pk not in cache:
            from . import progress
            cache[obj.pk] = next((l for l, st in progress.lesson_states(obj) if st == 'current'), None)
        return cache[obj.pk]

    def get_current_lesson_id(self, obj):
        lesson = self._current(obj)
        return lesson.id if lesson else None

    def get_current_lesson_title(self, obj):
        lesson = self._current(obj)
        return lesson.title if lesson else None

    def validate_certificate_name(self, value):
        return clean_certificate_name(value)

    def get_learning_status(self, obj):
        """not_started | in_progress | completed, as shown on the My Learning cards."""
        if obj.status == 'completed':
            return 'completed'
        return 'in_progress' if self._counts(obj)[1] > 0 else 'not_started'

    def validate(self, attrs):
        request = self.context.get("request")
        user = request.user if request else attrs.get("user")
        course = attrs.get("course")
        if Enrollment.objects.filter(user=user, course=course).exists():
            raise serializers.ValidationError(
                {"course_id": "You are already enrolled in this course."}
            )
        if not Lesson.objects.filter(module__course=course).exists():
            raise serializers.ValidationError(
                {"course_id": "This course has no lessons yet. Please check back soon."}
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
    course_title = serializers.SerializerMethodField()
    course_id = serializers.IntegerField(
        source="enrollment.course.id", read_only=True
    )
    file_url = serializers.SerializerMethodField()
    holder_name = serializers.SerializerMethodField()
    completed_at = serializers.DateTimeField(source="enrollment.completed_at", read_only=True)
    enrollment_id = serializers.IntegerField(source="enrollment.id", read_only=True)
    course_category = serializers.CharField(source="enrollment.course.category", read_only=True)

    class Meta:
        model = Certificate
        fields = [
            "id",
            "certificate_number",
            "course_title",
            "course_id",
            "course_category",
            "enrollment_id",
            "holder_name",
            "audience",
            "statement",
            "outcomes",
            "modules_summary",
            "signatories",
            "completed_on",
            "completed_at",
            "issued_at",
            "file_url",
        ]
        read_only_fields = ["id", "certificate_number", "issued_at"]

    def get_file_url(self, obj):
        return _absolute_url(self.context.get("request"), obj.file)

    def get_course_title(self, obj):
        return obj.course_title or obj.enrollment.course.title

    def get_holder_name(self, obj):
        from .certificate_pdf import recipient_name
        return recipient_name(obj)


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
    completed = serializers.SerializerMethodField()
    video_watched = serializers.SerializerMethodField()
    video_source = serializers.SerializerMethodField()
    video_kind = serializers.SerializerMethodField()
    video_percent = serializers.SerializerMethodField()
    notes_read = serializers.SerializerMethodField()
    requirement_met = serializers.SerializerMethodField()
    passing_score = serializers.SerializerMethodField()

    class Meta:
        model = Lesson
        fields = ['id', 'title', 'order', 'content', 'video_url', 'video_source', 'video_kind',
                  'video_required_percent', 'video_percent', 'video_watched', 'notes_read', 'requirement_met',
                  'passing_score', 'resource_file_url', 'duration_minutes', 'questions', 'completed']

    def get_video_source(self, obj):
        if obj.video_file:
            return _absolute_url(self.context.get('request'), obj.video_file)
        return obj.video_url or ''

    def get_video_kind(self, obj):
        from . import progress
        return progress.video_kind(obj)

    def get_video_percent(self, obj):
        from . import progress
        return progress.video_percent(self._row(obj))

    def get_notes_read(self, obj):
        row = self._row(obj)
        return bool(row and row.notes_read_at)

    def get_requirement_met(self, obj):
        enrollment = self.context.get('enrollment')
        if enrollment is None:
            return False
        from . import progress
        return progress.requirement_met(enrollment, obj)[0]

    def get_passing_score(self, obj):
        from . import progress
        return progress.passing_score_for(obj)

    def _row(self, obj):
        enrollment = self.context.get('enrollment')
        if enrollment is None:
            return None
        return LessonProgress.objects.filter(enrollment=enrollment, lesson=obj).first()

    def get_completed(self, obj):
        row = self._row(obj)
        return bool(row and row.completed)

    def get_video_watched(self, obj):
        # A lesson without a video is never reported as watched.
        row = self._row(obj)
        return bool(row and row.video_watched_at)

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


# ---------------------------------------------------------------------------
# Admin Course Builder serializers
# ---------------------------------------------------------------------------

class QuestionChoiceAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionChoice
        fields = ['id', 'text', 'is_correct', 'order']


class QuestionAdminSerializer(serializers.ModelSerializer):
    choices = QuestionChoiceAdminSerializer(many=True)

    class Meta:
        model = Question
        fields = ['id', 'text', 'order', 'explanation', 'choices']

    def create(self, validated_data):
        choices_data = validated_data.pop('choices', [])
        question = Question.objects.create(**validated_data)
        for i, c in enumerate(choices_data):
            c.setdefault('order', i)
            QuestionChoice.objects.create(question=question, **c)
        return question

    def update(self, instance, validated_data):
        choices_data = validated_data.pop('choices', None)
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.save()
        if choices_data is not None:
            existing = list(instance.choices.order_by('order', 'id'))
            for i, c in enumerate(choices_data):
                c = dict(c)
                c.setdefault('order', i)
                if i < len(existing):  # update in place so saved learner answers keep pointing at their choice
                    for attr, val in c.items():
                        setattr(existing[i], attr, val)
                    existing[i].save()
                else:
                    QuestionChoice.objects.create(question=instance, **c)
            for extra in existing[len(choices_data):]:
                if not extra.quizattemptanswer_set.exists():
                    extra.delete()
        return instance

    def validate_choices(self, value):
        if len(value) != 4:
            raise serializers.ValidationError('Each question needs exactly four choices (A, B, C and D).')
        if sum(1 for c in value if c.get('is_correct')) != 1:
            raise serializers.ValidationError('Mark exactly one choice as the correct answer.')
        if any(not str(c.get('text', '')).strip() for c in value):
            raise serializers.ValidationError('Every choice needs text.')
        return value


class LessonAdminSerializer(serializers.ModelSerializer):
    questions = QuestionAdminSerializer(many=True, read_only=True)
    resource_file_url = serializers.SerializerMethodField()

    class Meta:
        model = Lesson
        fields = [
            'id', 'title', 'order', 'content', 'video_url', 'video_file', 'video_file_url', 'video_required_percent',
            'passing_score', 'duration_minutes', 'resource_file_url', 'resource_file', 'questions',
        ]
        read_only_fields = ['id', 'resource_file_url', 'video_file_url', 'questions']
        extra_kwargs = {'resource_file': {'write_only': True, 'required': False},
                        'video_file': {'write_only': True, 'required': False, 'allow_null': True}}

    video_file_url = serializers.SerializerMethodField()

    def get_video_file_url(self, obj):
        return _absolute_url(self.context.get('request'), obj.video_file)

    def validate_video_file(self, value):
        return _validate_video_file(value)

    def validate_video_url(self, value):
        value = (value or '').strip()
        if value and not value.lower().startswith(('https://', 'http://')):
            raise serializers.ValidationError('Enter a full video link starting with https://')
        return value

    def get_resource_file_url(self, obj):
        return _absolute_url(self.context.get('request'), obj.resource_file)

    def validate_content(self, value):
        return _sanitize(value)


class CourseModuleAdminSerializer(serializers.ModelSerializer):
    lessons = LessonAdminSerializer(many=True, read_only=True)

    class Meta:
        model = CourseModule
        fields = ['id', 'title', 'order', 'description', 'lessons', 'created_at']
        read_only_fields = ['id', 'lessons', 'created_at']
