from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsAdminRole

from .models import SKBarangay, SKFeedback, SKRequirement
from .serializers import (
    SKBarangayDetailSerializer,
    SKBarangayListSerializer,
    SKFeedbackSerializer,
    SKRequirementSerializer,
)


# ---------------------------------------------------------------------------
# SKBarangayViewSet
# ---------------------------------------------------------------------------

class SKBarangayViewSet(viewsets.ModelViewSet):
    """
    list/retrieve: public.
    create/update/destroy: admin only.
    compliance_summary: admin only — per-barangay counts of submitted/pending/overdue.
    """

    pagination_class = None
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['barangay_name', 'sk_chairperson']
    ordering_fields = ['barangay_name', 'created_at']
    ordering = ['barangay_name']

    def get_queryset(self):
        qs = SKBarangay.objects.prefetch_related('requirements').annotate(
            total_requirements=Count('requirements', distinct=True),
            submitted_count=Count('requirements', filter=Q(requirements__status='submitted'), distinct=True),
            pending_count=Count('requirements', filter=Q(requirements__status='pending'), distinct=True),
            overdue_count=Count('requirements', filter=Q(requirements__status='overdue'), distinct=True),
        )
        if not (
            self.request.user.is_authenticated
            and IsAdminRole().has_permission(self.request, self)
        ):
            qs = qs.filter(is_active=True)
        return qs

    def get_serializer_class(self):
        if self.action == 'list':
            return SKBarangayListSerializer
        return SKBarangayDetailSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [AllowAny()]
        if self.action == 'upload_logo':
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdminRole()]

    # ------------------------------------------------------------------
    # Custom actions
    # ------------------------------------------------------------------

    @action(
        detail=True,
        methods=['post'],
        url_path='upload_logo',
        permission_classes=[IsAuthenticated],
        parser_classes=[MultiPartParser, FormParser],
    )
    def upload_logo(self, request, pk=None):
        barangay = self.get_object()
        is_admin = IsAdminRole().has_permission(request, self)
        user_barangay = getattr(getattr(request.user, 'profile', None), 'barangay', '') or ''
        is_own_sk = (
            getattr(request.user, 'youth_type', '') == 'sk'
            and user_barangay.strip().lower() == barangay.barangay_name.strip().lower()
        )
        if not (is_admin or is_own_sk):
            return Response(
                {'detail': 'You do not have permission to upload a logo for this barangay.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        if 'logo' not in request.FILES:
            return Response({'detail': 'No logo file provided.'}, status=status.HTTP_400_BAD_REQUEST)
        logo_file = request.FILES['logo']
        if not logo_file.content_type.startswith('image/'):
            return Response({'detail': 'File must be an image.'}, status=status.HTTP_400_BAD_REQUEST)
        if logo_file.size > 5 * 1024 * 1024:
            return Response({'detail': 'Image must not exceed 5 MB.'}, status=status.HTTP_400_BAD_REQUEST)
        barangay.logo = logo_file
        barangay.save(update_fields=['logo'])
        logo_url = request.build_absolute_uri(barangay.logo.url) if barangay.logo else None
        return Response({'logo_url': logo_url}, status=status.HTTP_200_OK)

    @action(
        detail=False,
        methods=['get'],
        url_path='compliance_summary',
        permission_classes=[IsAuthenticated, IsAdminRole],
    )
    def compliance_summary(self, request):
        """
        Returns a list of all barangays with counts of submitted / pending / overdue
        requirements.
        """
        queryset = SKBarangay.objects.annotate(
            submitted_count=Count('requirements', filter=Q(requirements__status='submitted')),
            pending_count=Count('requirements', filter=Q(requirements__status='pending')),
            overdue_count=Count('requirements', filter=Q(requirements__status='overdue')),
            total_count=Count('requirements'),
        ).order_by('barangay_name')

        data = [
            {
                'id': b.id,
                'barangay_name': b.barangay_name,
                'sk_chairperson': b.sk_chairperson,
                'total': b.total_count,
                'submitted': b.submitted_count,
                'pending': b.pending_count,
                'overdue': b.overdue_count,
            }
            for b in queryset
        ]
        return Response(data, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# SKRequirementViewSet
# ---------------------------------------------------------------------------

class SKRequirementViewSet(viewsets.ModelViewSet):
    """
    All actions: admin only.
    Supports filter by barangay, status, requirement_type.
    mark_submitted: sets status=submitted and records submitted_at.
    """

    serializer_class = SKRequirementSerializer
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['barangay', 'requirement_type', 'status', 'due_date', 'submitted_at']
    ordering = ['barangay', 'requirement_type']

    def get_queryset(self):
        qs = SKRequirement.objects.select_related('barangay', 'reviewed_by')

        barangay = self.request.query_params.get('barangay')
        req_status = self.request.query_params.get('status')
        requirement_type = self.request.query_params.get('requirement_type')

        if barangay:
            qs = qs.filter(barangay_id=barangay)
        if req_status:
            qs = qs.filter(status=req_status)
        if requirement_type:
            qs = qs.filter(requirement_type=requirement_type)

        # Auto-mark overdue: pending items whose due_date has passed
        today = timezone.now().date()
        qs.filter(status='pending', due_date__lt=today).update(status='overdue')

        return qs

    def get_permissions(self):
        return [IsAuthenticated(), IsAdminRole()]

    def perform_update(self, serializer):
        instance = self.get_object()
        new_status = serializer.validated_data.get('status', instance.status)
        submitted_at = instance.submitted_at
        if new_status == 'submitted' and instance.status != 'submitted':
            submitted_at = timezone.now()
        serializer.save(submitted_at=submitted_at)

    # ------------------------------------------------------------------
    # Custom actions
    # ------------------------------------------------------------------

    @action(
        detail=True,
        methods=['post'],
        url_path='mark_submitted',
        permission_classes=[IsAuthenticated, IsAdminRole],
        parser_classes=[MultiPartParser, FormParser, JSONParser],
    )
    def mark_submitted(self, request, pk=None):
        """Mark a requirement as submitted; optionally attach a PDF file."""
        requirement = self.get_object()
        if requirement.status == 'submitted':
            return Response(
                {'detail': 'Requirement is already marked as submitted.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        requirement.status = 'submitted'
        requirement.submitted_at = timezone.now()
        requirement.reviewed_by = request.user
        requirement.reviewed_at = timezone.now()
        update_fields = ['status', 'submitted_at', 'reviewed_by', 'reviewed_at', 'updated_at']
        if 'file' in request.FILES:
            requirement.file = request.FILES['file']
            update_fields.append('file')
        notes = request.data.get('notes', '').strip()
        if notes:
            requirement.notes = notes
            update_fields.append('notes')
        requirement.save(update_fields=update_fields)
        # Send notification to SK officers/admins for this barangay
        from apps.accounts.models import User
        from apps.notifications.models import Notification
        try:
            sk_user = User.objects.filter(
                barangay__iexact=requirement.barangay.barangay_name,
                role__in=['lgu_admin', 'super_admin'],
            ).first()
            if sk_user:
                Notification.objects.create(
                    user=sk_user,
                    title=f'Requirement Recorded: {requirement.get_requirement_type_display()}',
                    message=f'Your barangay\'s {requirement.get_requirement_type_display()} has been marked as submitted by LYDO admin.',
                    notification_type='system',
                )
        except Exception:
            pass
        serializer = SKRequirementSerializer(requirement, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(
        detail=True,
        methods=['patch'],
        url_path='set_due_date',
        permission_classes=[IsAuthenticated, IsAdminRole],
    )
    def set_due_date(self, request, pk=None):
        """Set or update the due date for a requirement."""
        requirement = self.get_object()
        due_date = request.data.get('due_date')
        if not due_date:
            return Response({'detail': 'due_date is required.'}, status=status.HTTP_400_BAD_REQUEST)
        requirement.due_date = due_date
        # Re-evaluate status based on new due date
        today = timezone.now().date()
        from datetime import date as date_type
        try:
            parsed = date_type.fromisoformat(str(due_date))
            if requirement.status == 'overdue' and parsed >= today:
                requirement.status = 'pending'
            elif requirement.status == 'pending' and parsed < today:
                requirement.status = 'overdue'
        except Exception:
            pass
        requirement.save(update_fields=['due_date', 'status', 'updated_at'])
        serializer = SKRequirementSerializer(requirement, context={'request': request})
        return Response(serializer.data)

    @action(
        detail=False,
        methods=['post'],
        url_path='bulk_create_for_barangay',
        permission_classes=[IsAuthenticated, IsAdminRole],
    )
    def bulk_create_for_barangay(self, request):
        """Create all standard requirement records for a barangay (idempotent)."""
        from .models import REQUIREMENT_CHOICES
        barangay_id = request.data.get('barangay_id')
        if not barangay_id:
            return Response({'detail': 'barangay_id required.'}, status=status.HTTP_400_BAD_REQUEST)
        barangay = get_object_or_404(SKBarangay, pk=barangay_id)
        created_count = 0
        for key, _ in REQUIREMENT_CHOICES:
            _, created = SKRequirement.objects.get_or_create(
                barangay=barangay,
                requirement_type=key,
                defaults={'status': 'pending'},
            )
            if created:
                created_count += 1
        return Response({'created': created_count, 'barangay': barangay.barangay_name})


# ---------------------------------------------------------------------------
# SKFeedbackViewSet
# ---------------------------------------------------------------------------

def _is_sk_user(user):
    return getattr(user, 'youth_type', '') == 'sk'


class SKFeedbackViewSet(viewsets.ModelViewSet):
    """
    POST   /sk-requirements/feedback/        — verified youth submits feedback to their own barangay SK
    GET    /sk-requirements/feedback/        — admin: all feedback (?barangay=id); SK: own barangay only
    PATCH  /sk-requirements/feedback/<id>/  — admin or SK (own barangay): update status
    """

    serializer_class = SKFeedbackSerializer
    http_method_names = ['get', 'post', 'patch', 'head', 'options']
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        if self.action == 'create':
            return [IsAuthenticated()]
        # list / partial_update: admin OR SK user (queryset scoping enforces barangay)
        return [IsAuthenticated()]

    def _user_is_admin(self):
        return IsAdminRole().has_permission(self.request, self)

    def get_queryset(self):
        user = self.request.user
        qs = SKFeedback.objects.select_related('barangay', 'submitted_by')

        if self._user_is_admin():
            barangay_id = self.request.query_params.get('barangay')
            if barangay_id:
                qs = qs.filter(barangay_id=barangay_id)
            return qs

        if _is_sk_user(user):
            user_barangay = (getattr(getattr(user, 'profile', None), 'barangay', '') or '').strip()
            return qs.filter(barangay__barangay_name__iexact=user_barangay)

        # regular youth: no access to list
        return qs.none()

    def create(self, request, *args, **kwargs):
        profile = getattr(request.user, 'profile', None)
        user_barangay = (getattr(profile, 'barangay', '') or '').strip()

        if not user_barangay:
            return Response(
                {'detail': 'Your profile does not have a barangay set. Please update your profile first.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            barangay = SKBarangay.objects.get(barangay_name__iexact=user_barangay)
        except SKBarangay.DoesNotExist:
            return Response(
                {'detail': f'No SK found for your barangay ({user_barangay}). Please contact LYDO.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        category = request.data.get('category', 'concern')
        if category not in ('concern', 'suggestion', 'praise'):
            return Response({'detail': 'Invalid category.'}, status=status.HTTP_400_BAD_REQUEST)

        subject = (request.data.get('subject') or '').strip()
        message = (request.data.get('message') or '').strip()
        if not subject:
            return Response({'detail': 'Subject is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if not message:
            return Response({'detail': 'Message is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if len(message) > 2000:
            return Response({'detail': 'Message must not exceed 2000 characters.'}, status=status.HTTP_400_BAD_REQUEST)

        rating = request.data.get('rating')
        if rating is not None and rating != '':
            try:
                rating = int(rating)
                if not (1 <= rating <= 5):
                    raise ValueError
            except (ValueError, TypeError):
                return Response({'detail': 'Rating must be between 1 and 5.'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            rating = None

        is_anonymous = str(request.data.get('is_anonymous', 'false')).lower() in ('true', '1')

        image = request.FILES.get('image')
        if image:
            if not image.content_type.startswith('image/'):
                return Response({'detail': 'Attachment must be an image.'}, status=status.HTTP_400_BAD_REQUEST)
            if image.size > 5 * 1024 * 1024:
                return Response({'detail': 'Image must not exceed 5 MB.'}, status=status.HTTP_400_BAD_REQUEST)

        feedback = SKFeedback.objects.create(
            barangay=barangay,
            submitted_by=request.user,
            category=category,
            subject=subject,
            message=message,
            rating=rating,
            is_anonymous=is_anonymous,
            image=image,
        )
        serializer = SKFeedbackSerializer(feedback, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        if not self._user_is_admin() and not _is_sk_user(request.user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        feedback = self.get_object()  # queryset scoping already limits SK to own barangay
        new_status = request.data.get('status')
        if new_status not in ('received', 'acknowledged', 'resolved'):
            return Response({'detail': 'Invalid status.'}, status=status.HTTP_400_BAD_REQUEST)
        feedback.status = new_status
        feedback.save(update_fields=['status'])
        return Response(SKFeedbackSerializer(feedback, context={'request': request}).data)
