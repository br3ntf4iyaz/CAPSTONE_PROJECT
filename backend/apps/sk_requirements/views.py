from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import filters, status, viewsets
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsAdminRole
from apps.accounts.uploads import IMAGE_EXTS, check_upload
from rest_framework.exceptions import ValidationError as DRFValidationError

from .models import REQUIREMENT_CHOICES, SKBarangay, SKFeedback, SKMember, SKRequirement
from .throttles import SKPhotoThrottle
from .serializers import (
    SKBarangayDetailSerializer,
    SKBarangayListSerializer,
    SKFeedbackSerializer,
    SKMemberAdminSerializer,
    SKRequirementSerializer,
    validate_pdf,
)


# ---------------------------------------------------------------------------
# SKBarangayViewSet
# ---------------------------------------------------------------------------

def can_manage_council_pictures(user, barangay):
    """LYDO admins, or a signed-in SK official of THIS barangay whose identity has been verified.

    SK status is chosen at sign-up, so it is not trusted on its own: the person must also have passed
    ID verification, otherwise anyone could claim to be SK and change the public pictures.
    """
    if not user or not user.is_authenticated:
        return False
    if getattr(user, 'role', '') in ('lgu_admin', 'super_admin'):
        return True
    own = _own_barangay(user)
    if own is None or own.pk != barangay.pk:
        return False
    try:
        return user.id_verification.status == 'approved'
    except Exception:
        return False


def _picture_denied(request, barangay):
    """A helpful 403 explaining WHY the person cannot change the pictures."""
    user = request.user
    if getattr(user, 'youth_type', '') == 'sk':
        own = _own_barangay(user)
        if own is not None and own.pk == barangay.pk:
            return Response(
                {'detail': 'Please verify your identity first (Verify ID) to change the council pictures.', 'code': 'verify_first'},
                status=status.HTTP_403_FORBIDDEN,
            )
    return Response({'detail': 'Only the SK of this barangay or LYDO staff can change these pictures.'}, status=status.HTTP_403_FORBIDDEN)


def _audit_picture(request, barangay, seat, action_name):
    from apps.accounts.models import AuditLog
    from apps.accounts.views import get_client_ip
    AuditLog.objects.create(
        user=request.user, action=action_name, model_name='SKBarangay', object_id=barangay.pk,
        ip_address=get_client_ip(request),
        details={'barangay': barangay.barangay_name, 'seat': seat, 'by': request.user.email},
    )


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
        qs = SKBarangay.objects.prefetch_related('requirements', 'members').annotate(
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
        if self.action in ('upload_logo', 'chairperson_photo', 'member_photo', 'official_name'):
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
        try:
            check_upload(logo_file, IMAGE_EXTS, 5 * 1024 * 1024, field=None)
        except DRFValidationError as e:
            return Response({'detail': str(e.detail[0])}, status=status.HTTP_400_BAD_REQUEST)
        barangay.logo = logo_file
        barangay.save(update_fields=['logo'])
        logo_url = request.build_absolute_uri(barangay.logo.url) if barangay.logo else None
        return Response({'logo_url': logo_url}, status=status.HTTP_200_OK)

    @action(
        detail=True,
        methods=['post'],
        url_path='chairperson-photo',
        permission_classes=[IsAuthenticated],
        parser_classes=[MultiPartParser, FormParser],
        throttle_classes=[SKPhotoThrottle],
    )
    def chairperson_photo(self, request, pk=None):
        """Set (file in 'photo') or remove (remove=true) the Chairperson's picture. Admin or verified SK of this barangay."""
        barangay = self.get_object()
        if not can_manage_council_pictures(request.user, barangay):
            return _picture_denied(request, barangay)
        if str(request.data.get('remove', '')).lower() in ('1', 'true') and 'photo' not in request.FILES:
            if barangay.chairperson_photo:
                barangay.chairperson_photo.delete(save=False)
                barangay.chairperson_photo = None
                barangay.save(update_fields=['chairperson_photo'])
            _audit_picture(request, barangay, 'chairperson', 'sk_photo_removed')
            return Response({'chairperson_photo_url': None})
        if 'photo' not in request.FILES:
            return Response({'detail': 'No photo provided.'}, status=status.HTTP_400_BAD_REQUEST)
        photo = request.FILES['photo']
        try:
            check_upload(photo, IMAGE_EXTS, 5 * 1024 * 1024, field=None)
        except DRFValidationError as e:
            return Response({'detail': str(e.detail[0])}, status=status.HTTP_400_BAD_REQUEST)
        old = barangay.chairperson_photo.name if barangay.chairperson_photo else None
        barangay.chairperson_photo = photo
        barangay.save(update_fields=['chairperson_photo'])
        if old and old != barangay.chairperson_photo.name:
            barangay.chairperson_photo.storage.delete(old)
        _audit_picture(request, barangay, 'chairperson', 'sk_photo_changed')
        return Response({'chairperson_photo_url': request.build_absolute_uri(barangay.chairperson_photo.url)})

    @action(
        detail=True,
        methods=['post'],
        url_path='member-photo',
        permission_classes=[IsAuthenticated],
        parser_classes=[MultiPartParser, FormParser],
        throttle_classes=[SKPhotoThrottle],
    )
    def member_photo(self, request, pk=None):
        """Set (file in 'photo') or remove (remove=true) the picture of one council member of THIS barangay."""
        barangay = self.get_object()
        if not can_manage_council_pictures(request.user, barangay):
            return _picture_denied(request, barangay)
        member = get_object_or_404(SKMember, pk=request.data.get('member') or 0, barangay=barangay)  # never another barangay's member
        if str(request.data.get('remove', '')).lower() in ('1', 'true') and 'photo' not in request.FILES:
            if member.photo:
                member.photo.storage.delete(member.photo.name)
                member.photo = None
                member.save(update_fields=['photo'])
            _audit_picture(request, barangay, f'{member.position}:{member.name}', 'sk_photo_removed')
            return Response({'id': member.id, 'photo_url': None})
        if 'photo' not in request.FILES:
            return Response({'detail': 'No photo provided.'}, status=status.HTTP_400_BAD_REQUEST)
        photo = request.FILES['photo']
        try:
            check_upload(photo, IMAGE_EXTS, 5 * 1024 * 1024, field=None)
        except DRFValidationError as e:
            return Response({'detail': str(e.detail[0])}, status=status.HTTP_400_BAD_REQUEST)
        old = member.photo.name if member.photo else None
        member.photo = photo
        member.save(update_fields=['photo'])
        if old and old != member.photo.name:
            member.photo.storage.delete(old)
        _audit_picture(request, barangay, f'{member.position}:{member.name}', 'sk_photo_changed')
        return Response({'id': member.id, 'photo_url': request.build_absolute_uri(member.photo.url)})

    @action(
        detail=True,
        methods=['post'],
        url_path='official-name',
        permission_classes=[IsAuthenticated],
        throttle_classes=[SKPhotoThrottle],
    )
    def official_name(self, request, pk=None):
        """Change the name of the Chairperson (member omitted) or of one council member. Verified SK of this barangay (or admin)."""
        import bleach
        barangay = self.get_object()
        if not can_manage_council_pictures(request.user, barangay):
            return _picture_denied(request, barangay)
        name = bleach.clean(str(request.data.get('name', '')), tags=[], strip=True).strip()
        if not name or len(name) > 200:
            return Response({'detail': 'Please enter a name (up to 200 characters).'}, status=status.HTTP_400_BAD_REQUEST)
        member_id = request.data.get('member')
        if member_id:
            member = get_object_or_404(SKMember, pk=member_id, barangay=barangay)
            member.name = name
            member.save(update_fields=['name'])
            _audit_picture(request, barangay, f'{member.position}:{name}', 'sk_name_changed')
            return Response({'id': member.id, 'name': name})
        barangay.sk_chairperson = name
        barangay.save(update_fields=['sk_chairperson'])
        _audit_picture(request, barangay, f'chairperson:{name}', 'sk_name_changed')
        return Response({'sk_chairperson': name})

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

def _own_barangay(user):
    """The SKBarangay an SK official belongs to (from their profile), or None."""
    if getattr(user, 'youth_type', '') != 'sk':
        return None
    name = (getattr(getattr(user, 'profile', None), 'barangay', '') or '').strip()
    if not name:
        return None
    return SKBarangay.objects.filter(barangay_name__iexact=name).first()


def _ensure_requirements(barangay):
    """Make sure a barangay has one row per standard requirement (idempotent)."""
    have = set(barangay.requirements.values_list('requirement_type', flat=True))
    missing = [code for code, _ in REQUIREMENT_CHOICES if code not in have]
    if missing:
        SKRequirement.objects.bulk_create(
            [SKRequirement(barangay=barangay, requirement_type=c) for c in missing]
        )


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
        # SK officials may read and upload their OWN barangay's checklist; the rest is admin only.
        if self.action in ('mine', 'upload'):
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdminRole()]

    @action(detail=False, methods=['get'], url_path='mine')
    def mine(self, request):
        """GET /sk-requirements/requirements/mine/: the signed-in SK official's checklist."""
        barangay = _own_barangay(request.user)
        if barangay is None:
            return Response(
                {'detail': 'This page is for SK officials whose profile has a barangay with an SK council.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        _ensure_requirements(barangay)
        today = timezone.now().date()
        barangay.requirements.filter(status='pending', due_date__lt=today).update(status='overdue')
        order = {code: i for i, (code, _) in enumerate(REQUIREMENT_CHOICES)}
        labels = dict(REQUIREMENT_CHOICES)
        rows = sorted(barangay.requirements.all(), key=lambda r: order.get(r.requirement_type, 99))
        items = [
            {
                'id': r.id, 'type': r.requirement_type, 'label': labels.get(r.requirement_type, r.requirement_type),
                'status': r.status, 'submitted_at': r.submitted_at, 'due_date': r.due_date,
                'notes': r.notes, 'has_file': bool(r.file),
            }
            for r in rows
        ]
        return Response({
            'barangay': {'id': barangay.id, 'name': barangay.barangay_name},
            'summary': {
                'submitted': sum(1 for i in items if i['status'] == 'submitted'),
                'total': len(items),
            },
            'requirements': items,
        })

    @action(
        detail=True,
        methods=['post'],
        url_path='upload',
        parser_classes=[MultiPartParser, FormParser, JSONParser],
    )
    def upload(self, request, pk=None):
        """POST /sk-requirements/requirements/<id>/upload/: an SK official submits a PDF for their barangay."""
        barangay = _own_barangay(request.user)
        req = get_object_or_404(SKRequirement, pk=pk)
        if barangay is None or req.barangay_id != barangay.id:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        file = request.FILES.get('file')
        if not file:
            return Response({'file': ['Please choose a PDF file.']}, status=status.HTTP_400_BAD_REQUEST)
        try:
            validate_pdf(file)
        except DRFValidationError as exc:
            return Response({'file': exc.detail}, status=status.HTTP_400_BAD_REQUEST)
        req.file = file
        req.status = 'submitted'
        req.submitted_at = timezone.now()
        req.save()  # the ledger signal fingerprints the submitted file
        from apps.compliance.sk_compliance import record_requirement_submission
        record_requirement_submission(req, request.user)  # SK Compliance Monitoring: index this exact file for verification
        return Response({'id': req.id, 'status': req.status, 'submitted_at': req.submitted_at})

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
        if 'file' in update_fields:
            from apps.compliance.sk_compliance import record_requirement_submission
            record_requirement_submission(requirement, request.user)  # index the stored file for verification
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
            try:
                check_upload(image, IMAGE_EXTS, 5 * 1024 * 1024, field=None)
            except DRFValidationError as e:
                return Response({'detail': str(e.detail[0])}, status=status.HTTP_400_BAD_REQUEST)

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


# ---------------------------------------------------------------------------
# SKMemberViewSet: admin management of the council members (with pictures)
# ---------------------------------------------------------------------------

class SKMemberViewSet(viewsets.ModelViewSet):
    """Admin only: add, edit and remove the Kagawads, Secretary and Treasurer of a barangay."""

    serializer_class = SKMemberAdminSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    pagination_class = None

    def get_queryset(self):
        qs = SKMember.objects.select_related('barangay').order_by('barangay__barangay_name', 'position', 'order', 'id')
        barangay = self.request.query_params.get('barangay')
        if barangay:
            qs = qs.filter(barangay_id=barangay)
        return qs

    def _audit(self, action_name, member, extra=None):
        from apps.accounts.models import AuditLog
        from apps.accounts.views import get_client_ip
        AuditLog.objects.create(
            user=self.request.user, action=action_name, model_name='SKMember', object_id=member.pk,
            ip_address=get_client_ip(self.request),
            details={'barangay': member.barangay.barangay_name, 'name': member.name, 'position': member.position, **(extra or {})},
        )

    def perform_create(self, serializer):
        member = serializer.save()
        self._audit('sk_official_added', member)

    def perform_update(self, serializer):
        member = serializer.save()
        self._audit('sk_official_updated', member)

    def perform_destroy(self, instance):
        self._audit('sk_official_removed', instance)
        if instance.photo:
            instance.photo.delete(save=False)
        instance.delete()

    @action(detail=True, methods=['post'], url_path='remove-photo')
    def remove_photo(self, request, pk=None):
        member = self.get_object()
        if member.photo:
            member.photo.delete(save=False)
            member.photo = None
            member.save(update_fields=['photo'])
        return Response(SKMemberAdminSerializer(member, context={'request': request}).data)
