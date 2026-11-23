from django.db import transaction
from django.db.models import ProtectedError
from django.db.models import Count
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdminRole
from apps.resources.pagination import LibraryPagination

from . import progress
from .certificate_pdf import build_certificate_pdf
from .models import (
    Certificate, CertificateSetting, Course, CourseModule, Enrollment, Lesson, LessonProgress,
    Question, QuestionChoice, QuizAttempt, QuizAttemptAnswer,
)
from .serializers import (
    CertificateSerializer,
    CourseDetailSerializer,
    CourseModuleAdminSerializer,
    CourseMiniSerializer,
    EnrollmentSerializer,
    LessonAdminSerializer,
    LessonDetailSerializer,
    LessonProgressDetailSerializer,
    LessonProgressSerializer,
    QuestionAdminSerializer,
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
    pagination_class = LibraryPagination  # the catalog shows every course, not only the first 20
    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    filterset_fields = ["category", "audience", "is_published", "is_featured"]
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
    filterset_fields = ["category", "audience", "is_published", "is_featured", "is_active"]
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

    # ── Module sub-resource ────────────────────────────────────────────────
    @action(detail=True, methods=['get', 'post'], url_path='modules')
    def modules(self, request, pk=None):
        course = self.get_object()
        if request.method == 'GET':
            qs = course.modules.prefetch_related(
                'lessons__questions__choices'
            ).order_by('order')
            return Response(
                CourseModuleAdminSerializer(qs, many=True, context={'request': request}).data
            )
        serializer = CourseModuleAdminSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save(course=course)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['patch', 'delete'], url_path=r'modules/(?P<module_pk>[^/.]+)')
    def module_detail(self, request, pk=None, module_pk=None):
        course = self.get_object()
        module = get_object_or_404(CourseModule, pk=module_pk, course=course)
        if request.method == 'DELETE':
            try:
                module.delete()
            except ProtectedError:
                return Response({'detail': 'Learners have already answered lessons in this module, so it cannot be deleted. Edit it instead.'},
                                status=status.HTTP_409_CONFLICT)
            return Response(status=status.HTTP_204_NO_CONTENT)
        serializer = CourseModuleAdminSerializer(module, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    # ── Lesson sub-resource (under module) ────────────────────────────────
    @action(detail=True, methods=['get', 'post'], url_path=r'modules/(?P<module_pk>[^/.]+)/lessons')
    def module_lessons(self, request, pk=None, module_pk=None):
        course = self.get_object()
        module = get_object_or_404(CourseModule, pk=module_pk, course=course)
        if request.method == 'GET':
            qs = module.lessons.prefetch_related('questions__choices').order_by('order')
            return Response(
                LessonAdminSerializer(qs, many=True, context={'request': request}).data
            )
        serializer = LessonAdminSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save(module=module)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['patch', 'delete'],
            url_path=r'modules/(?P<module_pk>[^/.]+)/lessons/(?P<lesson_pk>[^/.]+)')
    def lesson_detail(self, request, pk=None, module_pk=None, lesson_pk=None):
        course = self.get_object()
        module = get_object_or_404(CourseModule, pk=module_pk, course=course)
        lesson = get_object_or_404(Lesson, pk=lesson_pk, module=module)
        if request.method == 'DELETE':
            try:
                lesson.delete()
            except ProtectedError:
                return Response({'detail': 'Learners have already answered this lesson, so it cannot be deleted. Edit it instead.'},
                                status=status.HTTP_409_CONFLICT)
            return Response(status=status.HTTP_204_NO_CONTENT)
        serializer = LessonAdminSerializer(lesson, data=request.data, partial=True,
                                           context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    # ── Question sub-resource (under lesson) ──────────────────────────────
    @action(detail=True, methods=['get', 'post'],
            url_path=r'modules/(?P<module_pk>[^/.]+)/lessons/(?P<lesson_pk>[^/.]+)/questions')
    def lesson_questions(self, request, pk=None, module_pk=None, lesson_pk=None):
        course = self.get_object()
        module = get_object_or_404(CourseModule, pk=module_pk, course=course)
        lesson = get_object_or_404(Lesson, pk=lesson_pk, module=module)
        if request.method == 'GET':
            qs = lesson.questions.prefetch_related('choices').order_by('order')
            return Response(QuestionAdminSerializer(qs, many=True).data)
        serializer = QuestionAdminSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(lesson=lesson)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['patch', 'delete'],
            url_path=r'modules/(?P<module_pk>[^/.]+)/lessons/(?P<lesson_pk>[^/.]+)/questions/(?P<question_pk>[^/.]+)')
    def question_detail(self, request, pk=None, module_pk=None, lesson_pk=None, question_pk=None):
        course = self.get_object()
        module = get_object_or_404(CourseModule, pk=module_pk, course=course)
        lesson = get_object_or_404(Lesson, pk=lesson_pk, module=module)
        question = get_object_or_404(Question, pk=question_pk, lesson=lesson)
        if request.method == 'DELETE':
            try:
                question.delete()
            except ProtectedError:
                return Response({'detail': 'Learners have already answered this question, so it cannot be deleted. Edit it instead.'},
                                status=status.HTTP_409_CONFLICT)
            return Response(status=status.HTTP_204_NO_CONTENT)
        serializer = QuestionAdminSerializer(question, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def _is_admin(user):
    return getattr(user, 'role', '') in ('lgu_admin', 'super_admin')


_REQUIREMENT_TEXT = {
    'watch_first': 'Please watch the lesson video first.',
    'read_notes_first': 'Please read the lesson notes and confirm it first.',
}


def _locked_response():
    return Response(
        {'detail': 'This lesson is locked. Finish the previous lesson and its assessment first.', 'code': 'locked'},
        status=status.HTTP_403_FORBIDDEN,
    )


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
    POST   /enrollments/                          – enroll in a course
    GET    /enrollments/                          – list own enrollments
    GET    /enrollments/{id}/state/               – which lessons are done / current / locked
    GET    /enrollments/{id}/review/              – completed courses only: lessons + the learner's own answers
    POST   /enrollments/{id}/mark_lesson_complete/ – only for lessons that have no assessment
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = EnrollmentSerializer

    def get_queryset(self):
        return (
            Enrollment.objects.filter(user=self.request.user)
            .select_related("course", "course__instructor")
            .prefetch_related("course__modules")
            .annotate(enrollment_count=Count("course__enrollments"))
            .order_by("-enrolled_at", "-id")
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=["post"], url_path="mark_lesson_complete")
    def mark_lesson_complete(self, request, pk=None):
        """Complete a lesson that has NO assessment (after the video was watched). Lessons with an
        assessment can only be completed by passing it, so nobody can skip a quiz with this endpoint."""
        enrollment = self.get_object()
        lesson_id = request.data.get("lesson_id")
        if not lesson_id:
            return Response({"detail": "lesson_id is required."}, status=status.HTTP_400_BAD_REQUEST)
        lesson = Lesson.objects.filter(pk=lesson_id, module__course=enrollment.course).first()
        if lesson is None:
            return Response({"detail": "Lesson not found for this course."}, status=status.HTTP_404_NOT_FOUND)
        if not progress.is_unlocked(enrollment, lesson):
            return _locked_response()
        if lesson.questions.exists():
            return Response(
                {"detail": "This lesson has an assessment. Pass it to complete the lesson.", "code": "assessment_required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        ok, code = progress.requirement_met(enrollment, lesson)
        if not ok:
            return Response({"detail": _REQUIREMENT_TEXT[code], "code": code}, status=status.HTTP_400_BAD_REQUEST)
        progress.complete_lesson(enrollment, lesson)
        row = LessonProgress.objects.get(enrollment=enrollment, lesson=lesson)
        return Response(LessonProgressSerializer(row, context={"request": request}).data)

    @action(detail=True, methods=['get'], url_path='lesson-progress')
    def lesson_progress(self, request, pk=None):
        """Completed lessons of this enrollment (kept for existing screens)."""
        enrollment = self.get_object()
        rows = LessonProgress.objects.filter(enrollment=enrollment, completed=True).select_related('lesson')
        return Response([
            {'lesson_id': p.lesson.id, 'completed': True, 'completed_at': p.completed_at} for p in rows
        ])

    @action(detail=True, methods=['patch'], url_path='certificate-name')
    def certificate_name(self, request, pk=None):
        """Change the name for the certificate. Allowed only until the certificate is issued; after that the
        issued certificate keeps the original name."""
        enrollment = self.get_object()
        if enrollment.status == 'completed' or Certificate.objects.filter(enrollment=enrollment).exists():
            return Response({'detail': 'The certificate was already issued, so its name can no longer be changed.',
                             'code': 'certificate_issued'}, status=status.HTTP_400_BAD_REQUEST)
        from .serializers import clean_certificate_name
        name = clean_certificate_name(request.data.get('certificate_name'))
        enrollment.certificate_name = name
        enrollment.save(update_fields=['certificate_name'])
        return Response({'certificate_name': name})

    @action(detail=True, methods=['get'], url_path='state')
    def state(self, request, pk=None):
        """The whole course with the status of every lesson, so the screen can show locks and progress."""
        enrollment = self.get_object()
        course = enrollment.course
        rows = {r.lesson_id: r for r in LessonProgress.objects.filter(enrollment=enrollment)}
        states = progress.lesson_states(enrollment)
        counts = {
            row['lesson_id']: row['n'] for row in
            Question.objects.filter(lesson__module__course=course).values('lesson_id').annotate(n=Count('id'))
        }
        attempts = {}
        for a in QuizAttempt.objects.filter(enrollment=enrollment).order_by('attempted_at'):
            best = attempts.get(a.lesson_id)
            if best is None or (a.passed and not best.passed):
                attempts[a.lesson_id] = a
        modules = {}
        for lesson, st in states:
            m = modules.setdefault(lesson.module_id, {'id': lesson.module_id, 'title': lesson.module.title,
                                                      'order': lesson.module.order, 'lessons': []})
            best = attempts.get(lesson.id)
            m['lessons'].append({
                'id': lesson.id, 'title': lesson.title, 'order': lesson.order, 'status': st,
                'duration_minutes': lesson.duration_minutes, 'has_video': progress.video_kind(lesson) != 'none',
                'video_watched': bool(rows.get(lesson.id) and rows[lesson.id].video_watched_at),
                'video_percent': progress.video_percent(rows.get(lesson.id)),
                'question_count': counts.get(lesson.id, 0),
                'score': best.score if best else None, 'max_score': best.max_score if best else None,
            })
        cert = Certificate.objects.filter(enrollment=enrollment).first()
        total = len(states)
        done = sum(1 for _, st in states if st == 'completed')
        current = next((l.id for l, st in states if st == 'current'), None)
        return Response({
            'enrollment_id': enrollment.id, 'course_id': course.id, 'course_title': course.title,
            'audience': course.audience, 'audience_display': course.get_audience_display(),
            'certificate_name': enrollment.certificate_name,
            'status': enrollment.status, 'progress_percent': enrollment.progress_percent,
            'total_lessons': total, 'completed_lessons': done, 'current_lesson_id': current,
            'certificate_id': cert.id if cert else None,
            'modules': sorted(modules.values(), key=lambda m: (m['order'], m['id'])),
        })

    @action(detail=True, methods=['get'], url_path='review')
    def review(self, request, pk=None):
        """Read-only look back at a COMPLETED course: lessons, notes, and the learner's own saved answers.
        Nothing here changes progress, answers or the certificate."""
        enrollment = self.get_object()
        if enrollment.status != 'completed':
            return Response({'detail': 'You can review a course after you complete it.', 'code': 'not_completed'},
                            status=status.HTTP_403_FORBIDDEN)
        lessons = []
        for lesson, _st in progress.lesson_states(enrollment):
            questions = list(lesson.questions.prefetch_related('choices').order_by('order', 'id'))
            attempts = []
            for att in QuizAttempt.objects.filter(enrollment=enrollment, lesson=lesson).order_by('attempted_at', 'id'):
                chosen = {a.question_id: a for a in att.answers.select_related('selected_choice')}
                answers = []
                for q in questions:
                    a = chosen.get(q.id)
                    answers.append({
                        'question_id': q.id, 'text': q.text, 'explanation': q.explanation,
                        'selected_choice_id': a.selected_choice_id if a else None,
                        'is_correct': bool(a and a.is_correct),
                        'choices': [{'id': c.id, 'text': c.text, 'is_correct': c.is_correct} for c in q.choices.all()],
                    })
                attempts.append({
                    'id': att.id, 'score': att.score, 'max_score': att.max_score, 'passed': att.passed,
                    'percent': round(att.score * 100.0 / att.max_score) if att.max_score else 0,
                    'attempted_at': att.attempted_at, 'answers': answers,
                })
            counted = progress.best_attempt(enrollment, lesson)
            first = attempts[0] if attempts else None
            lessons.append({
                'id': lesson.id, 'title': lesson.title, 'order': lesson.order, 'module_id': lesson.module_id,
                'module_title': lesson.module.title, 'content': lesson.content,
                'video_source': (request.build_absolute_uri(lesson.video_file.url) if lesson.video_file else lesson.video_url),
                'video_kind': progress.video_kind(lesson), 'duration_minutes': lesson.duration_minutes,
                'passing_score': progress.passing_score_for(lesson),
                'original_score': first['score'] if first else None, 'original_max_score': first['max_score'] if first else None,
                'original_percent': first['percent'] if first else None,
                'counted_attempt_id': counted.id if counted else None,
                'attempts': attempts,
            })
        cert = Certificate.objects.filter(enrollment=enrollment).first()
        return Response({
            'enrollment_id': enrollment.id, 'course_id': enrollment.course_id, 'course_title': enrollment.course.title,
            'completed_at': enrollment.completed_at, 'certificate_id': cert.id if cert else None,
            'certificate_name': enrollment.certificate_name, 'lessons': lessons,
        })


# ---------------------------------------------------------------------------
# LessonViewSet
# ---------------------------------------------------------------------------

class LessonViewSet(mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """
    GET  /lessons/{id}/             — lesson detail with questions (enrolled and unlocked only)
    POST /lessons/{id}/watched/     — the learner confirms the video was watched
    POST /lessons/{id}/submit-quiz/ — submit assessment answers (graded on the server)
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = LessonDetailSerializer

    def get_queryset(self):
        return Lesson.objects.prefetch_related('questions__choices').select_related('module__course')

    def _enrollment(self, request, lesson):
        return Enrollment.objects.filter(user=request.user, course=lesson.module.course).first()

    def retrieve(self, request, *args, **kwargs):
        lesson = self.get_object()
        enrollment = self._enrollment(request, lesson)
        if enrollment is None:
            if _is_admin(request.user):  # admins can preview any lesson
                return Response(LessonDetailSerializer(lesson, context={'request': request}).data)
            return Response({'detail': 'Not enrolled in this course.'}, status=status.HTTP_403_FORBIDDEN)
        if not progress.is_unlocked(enrollment, lesson):
            return _locked_response()
        data = LessonDetailSerializer(lesson, context={'request': request, 'enrollment': enrollment}).data
        return Response(data)

    def _open_lesson(self, request, lesson):
        enrollment = self._enrollment(request, lesson)
        if enrollment is None:
            return None, Response({'detail': 'Not enrolled in this course.'}, status=status.HTTP_403_FORBIDDEN)
        if not progress.is_unlocked(enrollment, lesson):
            return None, _locked_response()
        return enrollment, None

    @action(detail=True, methods=['post'], url_path='video-progress')
    def video_progress(self, request, pk=None):
        """The player reports where it is (position and total length in seconds). The server credits playback
        time itself; see progress.record_video_progress."""
        lesson = self.get_object()
        enrollment, error = self._open_lesson(request, lesson)
        if error:
            return error
        if not progress.video_is_trackable(lesson):
            return Response({'detail': 'This lesson has no video that can be tracked.'}, status=status.HTTP_400_BAD_REQUEST)
        row = progress.record_video_progress(enrollment, lesson, request.data.get('position'), request.data.get('duration'))
        return Response({'video_percent': progress.video_percent(row), 'required_percent': lesson.video_required_percent,
                         'video_watched': row.video_watched_at is not None})

    @action(detail=True, methods=['post'], url_path='watched')
    def watched(self, request, pk=None):
        """Manual confirmation. Only for video links the server cannot measure (not YouTube, not an uploaded or
        direct file). For every other video the playback itself is the proof."""
        lesson = self.get_object()
        enrollment, error = self._open_lesson(request, lesson)
        if error:
            return error
        if progress.video_kind(lesson) != 'other':
            return Response({'detail': 'This video is checked by its playback progress. Please play it.', 'code': 'play_video'},
                            status=status.HTTP_400_BAD_REQUEST)
        row, _ = LessonProgress.objects.get_or_create(enrollment=enrollment, lesson=lesson)
        if row.video_watched_at is None:
            row.video_watched_at = timezone.now()
            row.save(update_fields=['video_watched_at'])
        return Response({'lesson_id': lesson.id, 'video_watched': True})

    @action(detail=True, methods=['post'], url_path='notes-read')
    def notes_read(self, request, pk=None):
        """For lessons that have no video: the learner confirms the notes were read. This never marks a video as watched."""
        lesson = self.get_object()
        enrollment, error = self._open_lesson(request, lesson)
        if error:
            return error
        if progress.video_kind(lesson) != 'none':
            return Response({'detail': 'This lesson has a video. Watch it instead.'}, status=status.HTTP_400_BAD_REQUEST)
        row, _ = LessonProgress.objects.get_or_create(enrollment=enrollment, lesson=lesson)
        if row.notes_read_at is None:
            row.notes_read_at = timezone.now()
            row.save(update_fields=['notes_read_at'])
        return Response({'lesson_id': lesson.id, 'notes_read': True})

    @action(detail=True, methods=['post'], url_path='submit-quiz')
    def submit_quiz(self, request, pk=None):
        lesson = self.get_object()
        submit_serializer = QuizSubmitSerializer(data=request.data)
        submit_serializer.is_valid(raise_exception=True)
        data = submit_serializer.validated_data

        try:
            enrollment = Enrollment.objects.get(id=data['enrollment_id'], user=request.user)
        except Enrollment.DoesNotExist:
            return Response({'detail': 'Enrollment not found.'}, status=status.HTTP_404_NOT_FOUND)
        if enrollment.course != lesson.module.course:
            return Response({'detail': 'Lesson does not belong to enrolled course.'}, status=status.HTTP_400_BAD_REQUEST)
        if not progress.is_unlocked(enrollment, lesson):
            return _locked_response()
        ok, code = progress.requirement_met(enrollment, lesson)
        if not ok:
            return Response({'detail': _REQUIREMENT_TEXT[code], 'code': code}, status=status.HTTP_400_BAD_REQUEST)

        questions = list(Question.objects.filter(lesson=lesson).prefetch_related('choices').order_by('order', 'id'))
        if not questions:
            return Response({'detail': 'This lesson has no quiz questions.'}, status=status.HTTP_400_BAD_REQUEST)

        submitted = {a['question_id']: a['choice_id'] for a in data['answers']}
        missing = [q.id for q in questions if q.id not in submitted]
        if missing:
            return Response({'detail': 'Please answer every question before submitting.', 'code': 'incomplete'},
                            status=status.HTTP_400_BAD_REQUEST)

        score = 0
        result_answers = []
        chosen_by_question = {}
        for q in questions:
            choices = {c.id: c for c in q.choices.all()}
            chosen = choices.get(submitted[q.id])
            if chosen is None:
                return Response({'detail': 'One of the answers is not a choice of its question.'},
                                status=status.HTTP_400_BAD_REQUEST)
            chosen_by_question[q.id] = chosen
            correct = next((c for c in choices.values() if c.is_correct), None)
            if chosen.is_correct:
                score += 1
            result_answers.append({
                'question_id': q.id, 'question_text': q.text, 'selected_choice_id': chosen.id,
                'correct_choice_id': correct.id if correct else None, 'is_correct': chosen.is_correct,
                'explanation': q.explanation,
            })

        max_score = len(questions)
        threshold = progress.passing_score_for(lesson)
        did_pass = progress.passed(score, max_score, threshold)
        with transaction.atomic():
            attempt = QuizAttempt.objects.create(
                enrollment=enrollment, lesson=lesson, score=score, max_score=max_score, passed=did_pass)
            for q in questions:
                chosen = chosen_by_question[q.id]
                QuizAttemptAnswer.objects.create(attempt=attempt, question=q, selected_choice=chosen, is_correct=chosen.is_correct)

        course_completed, certificate = False, None
        if did_pass:
            course_completed, certificate = progress.complete_lesson(enrollment, lesson)

        states = progress.lesson_states(enrollment)
        next_lesson = next((l.id for l, st in states if st == 'current'), None)
        result = {
            'attempt_id': attempt.id, 'score': score, 'max_score': max_score, 'passed': did_pass,
            'percent': round((score / max_score) * 100, 1), 'answers': result_answers,
        }
        payload = dict(QuizResultSerializer(result).data)
        payload.update({
            'passing_score': threshold,
            'next_lesson_id': next_lesson if did_pass else None,
            'course_completed': course_completed,
            'certificate_id': certificate.id if certificate else None,
            'progress_percent': enrollment.progress_percent,
        })
        return Response(payload)


# ---------------------------------------------------------------------------
# CertificateViewSet
# ---------------------------------------------------------------------------

class CertificateViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """
    GET /certificates/           – list user's own certificates
    GET /certificates/{id}/      – certificate detail
    GET /certificates/{id}/pdf/  – the certificate as a PDF (owner only)
    Certificates are created only by the server when a course is completed. There is no endpoint to claim one.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CertificateSerializer

    def get_queryset(self):
        return (
            Certificate.objects.filter(enrollment__user=self.request.user)
            .select_related("enrollment__course", "enrollment__user")
        )

    @action(detail=True, methods=['get'], url_path='pdf')
    def pdf(self, request, pk=None):
        certificate = self.get_object()  # the queryset already limits this to the signed-in user
        content = build_certificate_pdf(certificate)
        response = HttpResponse(content, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="Certificate-{certificate.certificate_number}.pdf"'
        response['Cache-Control'] = 'private, no-store'
        response['X-Content-Type-Options'] = 'nosniff'
        return response


# ---------------------------------------------------------------------------
# QuizAttemptViewSet  (read-only: attempts are only created by grading a submission on the server)
# ---------------------------------------------------------------------------

class AdminCertificateViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """Admins: every issued certificate, and verification of a certificate number."""
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]
    serializer_class = CertificateSerializer
    pagination_class = None

    def get_queryset(self):
        qs = Certificate.objects.select_related('enrollment__course', 'enrollment__user').order_by('-issued_at')
        q = (self.request.query_params.get('q') or '').strip()
        if q:
            from django.db.models import Q
            qs = qs.filter(Q(certificate_number__icontains=q) | Q(recipient_name__icontains=q) | Q(course_title__icontains=q))
        return qs

    @action(detail=False, methods=['get'], url_path='verify')
    def verify(self, request):
        number = (request.query_params.get('number') or '').strip().upper()
        cert = Certificate.objects.select_related('enrollment__course', 'enrollment__user').filter(certificate_number=number).first()
        if cert is None:
            return Response({'valid': False, 'detail': 'No certificate has this number.'})
        return Response({'valid': True, 'certificate': CertificateSerializer(cert, context={'request': request}).data,
                         'account_email': cert.enrollment.user.email})


class CertificateSettingView(APIView):
    """Admins: certificate branding and authorized signatories (a single row)."""
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]
    FIELDS = ('organization_name', 'platform_name', 'signatory_1_name', 'signatory_1_title',
              'signatory_2_name', 'signatory_2_title', 'footer_note')

    def _data(self, row):
        return {f: getattr(row, f) for f in self.FIELDS}

    def get(self, request):
        return Response(self._data(CertificateSetting.get()))

    def put(self, request):
        import bleach
        row = CertificateSetting.get()
        for f in self.FIELDS:
            if f in request.data:
                value = bleach.clean(str(request.data[f] or ''), tags=[], strip=True).strip()[:255]
                if f in ('organization_name', 'platform_name', 'footer_note') and not value:
                    return Response({f: 'This cannot be empty.'}, status=status.HTTP_400_BAD_REQUEST)
                setattr(row, f, value)
        row.save()
        return Response(self._data(row))


class QuizAttemptViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """GET /quiz-attempts/ – list own attempts"""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = QuizAttemptSerializer

    def get_queryset(self):
        return QuizAttempt.objects.filter(
            enrollment__user=self.request.user
        ).select_related("enrollment__course")
