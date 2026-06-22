from django.db.models import Count
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import IsAdminRole

from .models import (
    Certificate, Course, Enrollment, Lesson, LessonProgress,
    Question, QuestionChoice, QuizAttempt, QuizAttemptAnswer,
)
from .serializers import (
    CertificateSerializer,
    CourseDetailSerializer,
    CourseMiniSerializer,
    EnrollmentSerializer,
    LessonDetailSerializer,
    LessonProgressDetailSerializer,
    LessonProgressSerializer,
    QuizAttemptSerializer,
    QuizResultSerializer,
    QuizSubmitSerializer,
)


# ---------------------------------------------------------------------------
# CourseViewSet  (public read / admin write)
# ---------------------------------------------------------------------------

class CourseViewSet(viewsets.ReadOnlyModelViewSet):
    """
    list   GET  /courses/          – published, active courses (paginated)
    detail GET  /courses/{id}/     – full detail with modules + lessons
    """
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    filterset_fields = ["category", "is_published", "is_featured"]
    search_fields = ["title", "description", "category"]
    ordering_fields = ["created_at", "duration_hours", "enrollment_count"]
    ordering = ["-created_at"]

    def get_queryset(self):
        qs = (
            Course.objects.filter(is_active=True)
            .select_related("instructor")
            .prefetch_related("modules__lessons")
            .annotate(enrollment_count=Count("enrollments"))
        )
        # Non-admin users only see published courses
        user = self.request.user
        if not (user.is_authenticated and hasattr(user, "role") and
                user.role in ("lgu_admin", "super_admin")):
            qs = qs.filter(is_published=True)
        return qs

    def get_serializer_class(self):
        if self.action == "retrieve":
            return CourseDetailSerializer
        return CourseMiniSerializer


# ---------------------------------------------------------------------------
# CourseAdminViewSet  (full CRUD for admins)
# ---------------------------------------------------------------------------

class CourseAdminViewSet(viewsets.ModelViewSet):
    """
    Full CRUD access restricted to LGU Admin / Super Admin.
    Mounted at /admin/courses/
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]
    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    filterset_fields = ["category", "is_published", "is_featured", "is_active"]
    search_fields = ["title", "description", "category"]
    ordering_fields = ["created_at", "duration_hours", "enrollment_count"]

    def get_queryset(self):
        return (
            Course.objects.all()
            .select_related("instructor")
            .prefetch_related("modules__lessons")
            .annotate(enrollment_count=Count("enrollments"))
        )

    def get_serializer_class(self):
        if self.action in ("list",):
            return CourseMiniSerializer
        return CourseDetailSerializer

    def perform_create(self, serializer):
        serializer.save()

    def perform_destroy(self, instance):
        # Soft delete
        instance.is_active = False
        instance.save(update_fields=["is_active"])


# ---------------------------------------------------------------------------
# EnrollmentViewSet
# ---------------------------------------------------------------------------

class EnrollmentViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """
    POST   /enrollments/                        – enroll in a course
    GET    /enrollments/                        – list own enrollments
    POST   /enrollments/{id}/mark_lesson_complete/ – mark a lesson done
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = EnrollmentSerializer

    def get_queryset(self):
        return (
            Enrollment.objects.filter(user=self.request.user)
            .select_related("course", "course__instructor")
            .prefetch_related("course__modules")
            .annotate(enrollment_count=Count("course__enrollments"))
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=["post"], url_path="mark_lesson_complete")
    def mark_lesson_complete(self, request, pk=None):
        """
        POST /enrollments/{id}/mark_lesson_complete/
        Body: { "lesson_id": <int> }
        """
        enrollment = self.get_object()

        lesson_id = request.data.get("lesson_id")
        if not lesson_id:
            return Response(
                {"detail": "lesson_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            lesson = Lesson.objects.get(
                pk=lesson_id, module__course=enrollment.course
            )
        except Lesson.DoesNotExist:
            return Response(
                {"detail": "Lesson not found for this course."},
                status=status.HTTP_404_NOT_FOUND,
            )

        progress, created = LessonProgress.objects.get_or_create(
            enrollment=enrollment,
            lesson=lesson,
        )
        if not progress.completed:
            progress.completed = True
            progress.completed_at = timezone.now()
            progress.save(update_fields=["completed", "completed_at"])

        # Recalculate overall progress
        total_lessons = Lesson.objects.filter(
            module__course=enrollment.course
        ).count()
        completed_count = LessonProgress.objects.filter(
            enrollment=enrollment, completed=True
        ).count()

        if total_lessons > 0:
            enrollment.progress_percent = int(
                (completed_count / total_lessons) * 100
            )
            if enrollment.progress_percent >= 100:
                enrollment.status = "completed"
                enrollment.completed_at = timezone.now()
            elif enrollment.progress_percent > 0:
                enrollment.status = "in_progress"
            enrollment.save(
                update_fields=["progress_percent", "status", "completed_at"]
            )

        serializer = LessonProgressSerializer(
            progress, context={"request": request}
        )
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='lesson-progress')
    def lesson_progress(self, request, pk=None):
        """
        GET /enrollments/{id}/lesson-progress/
        Returns completed lessons for this enrollment.
        """
        enrollment = self.get_object()
        progresses = LessonProgress.objects.filter(
            enrollment=enrollment, completed=True
        ).select_related('lesson')
        data = [
            {'lesson_id': p.lesson.id, 'completed': True, 'completed_at': p.completed_at}
            for p in progresses
        ]
        return Response(data)


# ---------------------------------------------------------------------------
# LessonViewSet
# ---------------------------------------------------------------------------

class LessonViewSet(mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """
    GET  /lessons/{id}/             — lesson detail with questions (enrolled users only)
    POST /lessons/{id}/submit-quiz/ — submit quiz answers
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = LessonDetailSerializer

    def get_queryset(self):
        return Lesson.objects.prefetch_related('questions__choices').select_related('module__course')

    def retrieve(self, request, *args, **kwargs):
        lesson = self.get_object()
        is_enrolled = Enrollment.objects.filter(
            user=request.user, course=lesson.module.course
        ).exists()
        if not is_enrolled and not (
            hasattr(request.user, 'role') and request.user.role in ('lgu_admin', 'super_admin')
        ):
            return Response(
                {'detail': 'Not enrolled in this course.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = LessonDetailSerializer(lesson, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='submit-quiz')
    def submit_quiz(self, request, pk=None):
        lesson = self.get_object()
        submit_serializer = QuizSubmitSerializer(data=request.data)
        submit_serializer.is_valid(raise_exception=True)
        data = submit_serializer.validated_data

        # Verify enrollment
        try:
            enrollment = Enrollment.objects.get(id=data['enrollment_id'], user=request.user)
        except Enrollment.DoesNotExist:
            return Response({'detail': 'Enrollment not found.'}, status=status.HTTP_404_NOT_FOUND)

        if enrollment.course != lesson.module.course:
            return Response(
                {'detail': 'Lesson does not belong to enrolled course.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        questions = list(
            Question.objects.filter(lesson=lesson).prefetch_related('choices')
        )
        if not questions:
            return Response(
                {'detail': 'This lesson has no quiz questions.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        choice_map = {}
        for q in questions:
            for c in q.choices.all():
                choice_map[c.id] = c

        submitted = {a['question_id']: a['choice_id'] for a in data['answers']}

        # Grade
        score = 0
        result_answers = []
        for q in questions:
            correct_choice = next((c for c in q.choices.all() if c.is_correct), None)
            chosen_id = submitted.get(q.id)
            chosen = choice_map.get(chosen_id)
            is_correct = chosen is not None and chosen.is_correct
            if is_correct:
                score += 1
            result_answers.append({
                'question_id': q.id,
                'question_text': q.text,
                'selected_choice_id': chosen_id,
                'correct_choice_id': correct_choice.id if correct_choice else None,
                'is_correct': is_correct,
                'explanation': q.explanation,
            })

        max_score = len(questions)
        passed = score >= max(1, round(max_score * 0.7))  # 70% pass threshold
        percent = round((score / max_score) * 100, 1) if max_score else 0

        # Save attempt
        attempt = QuizAttempt.objects.create(
            enrollment=enrollment,
            lesson=lesson,
            score=score,
            max_score=max_score,
            passed=passed,
        )
        for q in questions:
            chosen_id = submitted.get(q.id)
            chosen = choice_map.get(chosen_id)
            if chosen:
                QuizAttemptAnswer.objects.create(
                    attempt=attempt,
                    question=q,
                    selected_choice=chosen,
                    is_correct=chosen.is_correct,
                )

        # Auto-complete lesson if passed
        if passed:
            progress, _ = LessonProgress.objects.get_or_create(
                enrollment=enrollment, lesson=lesson
            )
            if not progress.completed:
                progress.completed = True
                progress.completed_at = timezone.now()
                progress.save(update_fields=['completed', 'completed_at'])
                # Recalculate enrollment progress
                total_lessons = Lesson.objects.filter(
                    module__course=enrollment.course
                ).count()
                completed_count = LessonProgress.objects.filter(
                    enrollment=enrollment, completed=True
                ).count()
                if total_lessons > 0:
                    enrollment.progress_percent = int((completed_count / total_lessons) * 100)
                    if enrollment.progress_percent >= 100:
                        enrollment.status = 'completed'
                        enrollment.completed_at = timezone.now()
                    elif enrollment.progress_percent > 0:
                        enrollment.status = 'in_progress'
                    enrollment.save(update_fields=['progress_percent', 'status', 'completed_at'])

        result = {
            'attempt_id': attempt.id,
            'score': score,
            'max_score': max_score,
            'passed': passed,
            'percent': percent,
            'answers': result_answers,
        }
        return Response(QuizResultSerializer(result).data)


# ---------------------------------------------------------------------------
# CertificateViewSet
# ---------------------------------------------------------------------------

class CertificateViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """
    GET /certificates/       – list user's own certificates
    GET /certificates/{id}/  – certificate detail
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CertificateSerializer

    def get_queryset(self):
        return (
            Certificate.objects.filter(enrollment__user=self.request.user)
            .select_related("enrollment__course")
        )


# ---------------------------------------------------------------------------
# QuizAttemptViewSet
# ---------------------------------------------------------------------------

class QuizAttemptViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    """
    POST /quiz-attempts/   – submit a quiz attempt
    GET  /quiz-attempts/   – list own attempts
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = QuizAttemptSerializer

    def get_queryset(self):
        return QuizAttempt.objects.filter(
            enrollment__user=self.request.user
        ).select_related("enrollment__course")

    def perform_create(self, serializer):
        serializer.save()
