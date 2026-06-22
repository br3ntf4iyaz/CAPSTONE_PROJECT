import random
import string

from django.db import transaction
from django.db.models import Count, Prefetch
from django.shortcuts import get_object_or_404
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsAdminRole

from .models import (
    Event,
    EventRegistration,
    FeaturedPost,
    Poll,
    PollOption,
    PollResponse,
    Survey,
    SurveyResponse,
    Feedback,
)
from .serializers import (
    AttendanceSerializer,
    EventDetailSerializer,
    EventListSerializer,
    EventRegistrationSerializer,
    FeaturedPostSerializer,
    FeedbackSerializer,
    PollResponseSerializer,
    PollSerializer,
    SurveyResponseSerializer,
    SurveySerializer,
)


# ---------------------------------------------------------------------------
# EventViewSet
# ---------------------------------------------------------------------------

class EventViewSet(viewsets.ModelViewSet):
    """
    list/retrieve: authenticated users see published+active events.
    create/update/destroy: admin only.
    register / unregister: authenticated users.
    attendance: admin only.
    """

    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['title', 'description', 'location']
    ordering_fields = ['start_datetime', 'created_at', 'title']
    ordering = ['start_datetime']

    def get_queryset(self):
        qs = Event.objects.select_related('organizer').annotate(registration_count=Count('registrations', distinct=True))
        if not (self.request.user.is_authenticated and IsAdminRole().has_permission(self.request, self)):
            qs = qs.filter(is_published=True, is_active=True)
        # Optional filters
        is_featured = self.request.query_params.get('is_featured')
        if is_featured in ('true', '1'):
            qs = qs.filter(is_featured=True)
        return qs

    def get_serializer_class(self):
        if self.action in ('list',):
            return EventListSerializer
        return EventDetailSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [AllowAny()]
        if self.action in ('register', 'unregister', 'checkin'):
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdminRole()]

    def perform_create(self, serializer):
        serializer.save(organizer=self.request.user)

    # ------------------------------------------------------------------
    # Custom actions
    # ------------------------------------------------------------------

    @action(detail=True, methods=['post'], url_path='register', permission_classes=[IsAuthenticated])
    def register(self, request, pk=None):
        # Only verified users may register for events
        try:
            verified = request.user.id_verification.status == "approved"
        except Exception:
            verified = False
        if not verified:
            return Response(
                {"detail": "Identity verification required to register for events. Please verify your ID first."},
                status=status.HTTP_403_FORBIDDEN,
            )

        event = self.get_object()
        with transaction.atomic():
            locked_event = Event.objects.select_for_update().get(pk=event.pk)
            if EventRegistration.objects.filter(event=locked_event, user=request.user).exists():
                return Response({'detail': 'You are already registered for this event.'}, status=status.HTTP_400_BAD_REQUEST)
            if locked_event.capacity and locked_event.registrations.count() >= locked_event.capacity:
                return Response({'detail': 'This event has reached its capacity.'}, status=status.HTTP_400_BAD_REQUEST)
            registration = EventRegistration.objects.create(event=locked_event, user=request.user)
        serializer = EventRegistrationSerializer(registration, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='unregister', permission_classes=[IsAuthenticated])
    def unregister(self, request, pk=None):
        event = self.get_object()
        registration = EventRegistration.objects.filter(event=event, user=request.user).first()
        if not registration:
            return Response(
                {'detail': 'You are not registered for this event.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        registration.delete()
        return Response({'detail': 'Unregistered successfully.'}, status=status.HTTP_200_OK)

    @action(
        detail=True,
        methods=['get'],
        url_path='attendance',
        permission_classes=[IsAuthenticated, IsAdminRole],
    )
    def attendance(self, request, pk=None):
        event = self.get_object()
        registrations = event.registrations.select_related('user').all()
        serializer = AttendanceSerializer(registrations, many=True)
        return Response(serializer.data)

    @action(
        detail=True,
        methods=['patch'],
        url_path=r'attendance/(?P<reg_pk>\d+)',
        permission_classes=[IsAuthenticated, IsAdminRole],
    )
    def attendance_update(self, request, pk=None, reg_pk=None):
        event = self.get_object()
        registration = get_object_or_404(EventRegistration, pk=reg_pk, event=event)
        attended = request.data.get('attended')
        if attended is not None:
            registration.attended = bool(attended)
            registration.save(update_fields=['attended'])
        return Response(AttendanceSerializer(registration).data)

    @action(
        detail=True,
        methods=['post'],
        url_path='start-checkin',
        permission_classes=[IsAuthenticated, IsAdminRole],
    )
    def start_checkin(self, request, pk=None):
        event = self.get_object()
        code = ''.join(random.choices(string.digits, k=6))
        event.check_in_code = code
        event.check_in_active = True
        event.save(update_fields=['check_in_code', 'check_in_active'])
        return Response({'check_in_code': code, 'check_in_active': True})

    @action(
        detail=True,
        methods=['post'],
        url_path='end-checkin',
        permission_classes=[IsAuthenticated, IsAdminRole],
    )
    def end_checkin(self, request, pk=None):
        event = self.get_object()
        event.check_in_active = False
        event.check_in_code = ''
        event.save(update_fields=['check_in_active', 'check_in_code'])
        return Response({'check_in_active': False})

    @action(
        detail=True,
        methods=['post'],
        url_path='checkin',
        permission_classes=[IsAuthenticated],
    )
    def checkin(self, request, pk=None):
        event = self.get_object()
        if not event.check_in_active:
            return Response(
                {'detail': 'Check-in is not currently open for this event.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        code = str(request.data.get('code', '')).strip()
        if not code or code != event.check_in_code:
            return Response(
                {'detail': 'Incorrect check-in code. Please try again.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        registration = EventRegistration.objects.filter(event=event, user=request.user).first()
        if not registration:
            return Response(
                {'detail': 'You are not registered for this event.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if registration.attended:
            return Response({'detail': 'You have already checked in.', 'attended': True})
        registration.attended = True
        registration.save(update_fields=['attended'])
        return Response({'detail': 'Checked in successfully!', 'attended': True})


# ---------------------------------------------------------------------------
# PollViewSet
# ---------------------------------------------------------------------------

class PollViewSet(viewsets.ModelViewSet):
    """
    list/retrieve: authenticated users.
    create/update/destroy: admin only.
    vote: authenticated users.
    """

    serializer_class = PollSerializer

    def get_queryset(self):
        qs = Poll.objects.select_related('created_by').prefetch_related(
            Prefetch('options', queryset=PollOption.objects.annotate(vote_count=Count('responses', distinct=True)))
        )
        event_pk = self.kwargs.get('event_pk')
        if event_pk:
            qs = qs.filter(event_id=event_pk)
        if not (self.request.user.is_authenticated and IsAdminRole().has_permission(self.request, self)):
            qs = qs.filter(is_active=True)
        return qs

    def get_permissions(self):
        if self.action in ('list', 'retrieve', 'vote'):
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdminRole()]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'], url_path='vote', permission_classes=[IsAuthenticated])
    def vote(self, request, pk=None, **kwargs):
        poll = self.get_object()
        data = {**request.data, 'poll': poll.id}
        serializer = PollResponseSerializer(data=data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


# ---------------------------------------------------------------------------
# SurveyViewSet
# ---------------------------------------------------------------------------

class SurveyViewSet(viewsets.ModelViewSet):
    """
    list/retrieve: authenticated users see active surveys.
    create/update/destroy: admin only.
    submit_response: authenticated users.
    """

    serializer_class = SurveySerializer

    def get_queryset(self):
        qs = Survey.objects.select_related('created_by').prefetch_related('questions', 'responses')
        event_pk = self.kwargs.get('event_pk')
        if event_pk:
            qs = qs.filter(event_id=event_pk)
        if not (self.request.user.is_authenticated and IsAdminRole().has_permission(self.request, self)):
            qs = qs.filter(is_active=True)
        return qs

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [AllowAny()]
        if self.action in ('submit_response', 'analytics'):
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdminRole()]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(
        detail=True,
        methods=['post'],
        url_path='submit',
        permission_classes=[IsAuthenticated],
    )
    def submit_response(self, request, pk=None, **kwargs):
        survey = self.get_object()
        data = {**request.data, 'survey': survey.id}
        serializer = SurveyResponseSerializer(data=data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(
        detail=True,
        methods=['post'],
        url_path='add-question',
        permission_classes=[IsAuthenticated, IsAdminRole],
    )
    def add_question(self, request, pk=None, **kwargs):
        """Admin adds a question with choices to a survey."""
        from .models import SurveyQuestion as SQ
        survey = self.get_object()
        q_text = request.data.get('question', '').strip()
        q_type = request.data.get('type', 'multiple_choice')
        choices = request.data.get('choices', [])
        if not q_text:
            return Response({'detail': 'Question text required.'}, status=status.HTTP_400_BAD_REQUEST)
        order = survey.questions.count()
        q = SQ.objects.create(
            survey=survey,
            question=q_text,
            question_type=q_type,
            choices=choices if isinstance(choices, list) else [],
            order=order,
        )
        from .serializers import SurveyQuestionSerializer
        return Response(SurveyQuestionSerializer(q).data, status=status.HTTP_201_CREATED)

    @action(
        detail=True,
        methods=['get'],
        url_path='analytics',
        permission_classes=[IsAuthenticated],
    )
    def analytics(self, request, pk=None, **kwargs):
        """Returns aggregated response analytics per question."""
        from collections import Counter
        survey = self.get_object()
        responses = list(survey.responses.values_list('answers', flat=True))
        total_responses = len(responses)

        results = []
        for q in survey.questions.all():
            qid = str(q.id)
            raw_answers = [r.get(qid) for r in responses if r.get(qid) is not None]
            count = len(raw_answers)

            if q.question_type == 'multiple_choice' and q.choices:
                tally = Counter(str(a) for a in raw_answers)
                breakdown = [
                    {'choice': c, 'count': tally.get(c, 0),
                     'pct': round(tally.get(c, 0) / count * 100) if count else 0}
                    for c in q.choices
                ]
            elif q.question_type in ('rating', 'scale', 'number'):
                nums = [float(a) for a in raw_answers if a not in (None, '')]
                avg = round(sum(nums) / len(nums), 1) if nums else None
                tally = Counter(str(int(float(a))) for a in nums)
                if q.question_type == 'rating':
                    # Fixed 1-5 scale
                    breakdown = [
                        {'choice': str(i), 'count': tally.get(str(i), 0),
                         'pct': round(tally.get(str(i), 0) / count * 100) if count else 0}
                        for i in range(1, 6)
                    ]
                elif q.question_type == 'scale':
                    # Fixed 1-10 scale
                    breakdown = [
                        {'choice': str(i), 'count': tally.get(str(i), 0),
                         'pct': round(tally.get(str(i), 0) / count * 100) if count else 0}
                        for i in range(1, 11)
                    ]
                else:
                    # 'number' type: show distribution of actual values only
                    breakdown = [
                        {'choice': k, 'count': v,
                         'pct': round(v / count * 100) if count else 0}
                        for k, v in sorted(tally.items(), key=lambda x: float(x[0]))
                    ]
                results.append({
                    'question_id': q.id,
                    'question': q.question,
                    'question_type': q.question_type,
                    'response_count': count,
                    'average': avg,
                    'breakdown': breakdown,
                })
                continue
            elif q.question_type == 'yes_no':
                tally = Counter(str(a).lower() for a in raw_answers)
                breakdown = [
                    {'choice': 'Yes', 'count': tally.get('yes', 0),
                     'pct': round(tally.get('yes', 0) / count * 100) if count else 0},
                    {'choice': 'No', 'count': tally.get('no', 0),
                     'pct': round(tally.get('no', 0) / count * 100) if count else 0},
                ]
            else:  # text
                breakdown = [{'choice': str(a), 'count': 1, 'pct': 0} for a in raw_answers[:20]]

            results.append({
                'question_id': q.id,
                'question': q.question,
                'question_type': q.question_type,
                'response_count': count,
                'breakdown': breakdown,
            })

        return Response({
            'survey_id': survey.id,
            'title': survey.title,
            'total_responses': total_responses,
            'questions': results,
        })


# ---------------------------------------------------------------------------
# FeedbackViewSet
# ---------------------------------------------------------------------------

class FeedbackViewSet(viewsets.ModelViewSet):
    """
    create: authenticated users.
    list/retrieve: owners see own; admins see all.
    update/destroy: admin only.
    """

    serializer_class = FeedbackSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Feedback.objects.select_related('user', 'event')
        if IsAdminRole().has_permission(self.request, self):
            return qs
        return qs.filter(user=user)

    def get_permissions(self):
        if self.action == 'create':
            return [IsAuthenticated()]
        if self.action in ('update', 'partial_update', 'destroy'):
            return [IsAuthenticated(), IsAdminRole()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


# ---------------------------------------------------------------------------
# FeaturedPostViewSet
# ---------------------------------------------------------------------------

class FeaturedPostViewSet(viewsets.ModelViewSet):
    serializer_class = FeaturedPostSerializer

    def get_queryset(self):
        qs = FeaturedPost.objects.all()
        if not (self.request.user.is_authenticated and IsAdminRole().has_permission(self.request, self)):
            qs = qs.filter(is_published=True)
        return qs

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            from rest_framework.permissions import AllowAny
            return [AllowAny()]
        return [IsAuthenticated(), IsAdminRole()]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
