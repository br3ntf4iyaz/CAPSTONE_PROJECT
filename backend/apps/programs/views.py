from django.shortcuts import get_object_or_404
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from django.contrib.auth import get_user_model

from apps.accounts.permissions import IsAdminRole
from apps.notifications.models import Notification

from .models import FeaturedSlide, ProgramSubmission, SubmissionAttachment, SubmissionReviewLog, YouthProgram
from .serializers import (
    CompletionReportSerializer,
    FeaturedSlideSerializer,
    ProgramDetailSerializer,
    ProgramListSerializer,
    ProgramSubmissionSerializer,
    SubmissionAttachmentSerializer,
    SubmissionCreateSerializer,
    SubmissionDetailSerializer,
    SubmissionListSerializer,
    SubmissionReviewSerializer,
)


# ---------------------------------------------------------------------------
# Notification helpers
# ---------------------------------------------------------------------------

def _notify_admins(title: str, message: str) -> None:
    """Create a project-type Notification for every active admin user."""
    User = get_user_model()
    admins = User.objects.filter(role__in=['lgu_admin', 'super_admin'], is_active=True)
    Notification.objects.bulk_create([
        Notification(
            user=admin,
            title=title,
            message=message,
            notification_type='project',
            link='/admin/projects',
        )
        for admin in admins
    ])


def _notify_submitter(submission: ProgramSubmission, title: str, message: str) -> None:
    """Create a project-type Notification for the submission owner."""
    if submission.submitted_by:
        Notification.objects.create(
            user=submission.submitted_by,
            title=title,
            message=message,
            notification_type='project',
            link='/submissions',
        )


# ---------------------------------------------------------------------------
# YouthProgramViewSet
# ---------------------------------------------------------------------------

class YouthProgramViewSet(viewsets.ModelViewSet):
    """
    list: public — filter by category, status, barangay, submitter_type, is_featured.
    retrieve: public.
    create/update/destroy: admin only.
    featured_completed: public — completed programs with is_featured=True (for homepage).
    """

    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['title', 'description', 'barangay', 'location']
    ordering_fields = ['title', 'start_date', 'created_at', 'is_featured']
    ordering = ['-is_featured', '-created_at']

    def get_queryset(self):
        qs = YouthProgram.objects.select_related('organization', 'submitted_by')

        # Query-param filters
        category = self.request.query_params.get('category')
        prog_status = self.request.query_params.get('status')
        barangay = self.request.query_params.get('barangay')
        submitter_type = self.request.query_params.get('submitter_type')
        is_featured = self.request.query_params.get('is_featured')

        if category:
            qs = qs.filter(category=category)
        if prog_status:
            qs = qs.filter(status=prog_status)
        if barangay:
            qs = qs.filter(barangay__icontains=barangay)
        if submitter_type:
            qs = qs.filter(submitter_type=submitter_type)
        if is_featured is not None:
            qs = qs.filter(is_featured=is_featured.lower() in ('true', '1', 'yes'))

        return qs

    def get_serializer_class(self):
        if self.action == 'list':
            return ProgramListSerializer
        return ProgramDetailSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve', 'featured_completed'):
            return [AllowAny()]
        return [IsAuthenticated(), IsAdminRole()]

    def perform_create(self, serializer):
        serializer.save(submitted_by=self.request.user)

    # ------------------------------------------------------------------
    # Custom actions
    # ------------------------------------------------------------------

    @action(
        detail=False,
        methods=['get'],
        url_path='featured_completed',
        permission_classes=[AllowAny],
    )
    def featured_completed(self, request):
        """
        Returns completed programs marked as featured — intended for the
        homepage / landing page showcase.
        """
        qs = YouthProgram.objects.filter(
            status='completed', is_featured=True
        ).select_related('organization', 'submitted_by').order_by('-updated_at')
        serializer = ProgramListSerializer(qs, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# ProgramSubmissionViewSet
# ---------------------------------------------------------------------------

class ProgramSubmissionViewSet(viewsets.ModelViewSet):
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['submitted_at', 'updated_at', 'status']
    ordering = ['-submitted_at']

    def get_serializer_class(self):
        if self.action == 'list':
            return SubmissionListSerializer
        if self.action in ('create', 'update', 'partial_update'):
            return SubmissionCreateSerializer
        if self.action in ('review', 'approve', 'reject', 'request_revision'):
            return SubmissionReviewSerializer
        if self.action == 'submit_completion':
            return CompletionReportSerializer
        return SubmissionDetailSerializer

    def get_queryset(self):
        user = self.request.user
        qs = ProgramSubmission.objects.select_related(
            'submitted_by', 'program', 'organization', 'reviewed_by'
        ).prefetch_related('attachments', 'review_logs__actor')

        is_admin = IsAdminRole().has_permission(self.request, self)

        if is_admin:
            submitter_type = self.request.query_params.get('submitter_type')
            sub_status = self.request.query_params.get('status')
            organization = self.request.query_params.get('organization')
            if submitter_type:
                qs = qs.filter(submitter_type=submitter_type)
            if sub_status:
                qs = qs.filter(status=sub_status)
            if organization:
                qs = qs.filter(organization_id=organization)
            return qs

        return qs.filter(submitted_by=user)

    def get_permissions(self):
        if self.action == 'create':
            return [IsAuthenticated()]
        if self.action in ('update', 'partial_update', 'destroy'):
            return [IsAuthenticated()]
        if self.action in ('review', 'approve', 'reject', 'request_revision'):
            return [IsAuthenticated(), IsAdminRole()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save(submitted_by=self.request.user, status='draft')

    def perform_update(self, serializer):
        instance = serializer.instance
        if instance.submitted_by != self.request.user:
            raise PermissionDenied("You can only edit your own submissions.")
        if instance.status not in ('draft', 'revision_requested'):
            raise PermissionDenied("Cannot edit a submission that is not in draft or revision_requested status.")
        serializer.save()

    def perform_destroy(self, instance):
        is_admin = IsAdminRole().has_permission(self.request, self)
        if not is_admin:
            if instance.submitted_by != self.request.user:
                raise PermissionDenied("You can only delete your own submissions.")
            if instance.status not in ('draft', 'revision_requested'):
                raise PermissionDenied("Submitted submissions cannot be deleted.")
        instance.delete()

    # ── Custom actions ──────────────────────────────────────────────────────

    @action(detail=True, methods=['post'], url_path='submit')
    def submit_for_review(self, request, pk=None):
        """Submitter submits draft for admin review."""
        submission = self.get_object()
        if submission.submitted_by != request.user:
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        if submission.status not in ('draft', 'revision_requested'):
            return Response(
                {'detail': 'Only draft or revision_requested submissions can be submitted.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        from django.utils import timezone
        submission.status = 'pending'
        submission.save(update_fields=['status'])
        SubmissionReviewLog.objects.create(
            submission=submission,
            action='submitted',
            notes='Submitted for review.',
            actor=request.user,
        )
        submitter_name = getattr(request.user, 'full_name', None) or request.user.email
        _notify_admins(
            title=f'New Report Submitted: {submission.title[:60]}',
            message=(
                f'{submitter_name} submitted an accomplishment report for review. '
                f'Category: {submission.get_category_display()}.'
            ),
        )
        serializer = SubmissionDetailSerializer(submission, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['patch'], url_path='review', permission_classes=[IsAuthenticated, IsAdminRole])
    def review(self, request, pk=None):
        """Admin quick-review: update status + notes."""
        submission = self.get_object()
        new_status = request.data.get('status')
        admin_notes = request.data.get('admin_notes', submission.admin_notes)
        allowed = ['pending', 'reviewed', 'approved', 'rejected', 'revision_requested']
        if new_status and new_status not in allowed:
            return Response({'detail': 'Invalid status.'}, status=status.HTTP_400_BAD_REQUEST)
        if new_status:
            submission.status = new_status
        submission.admin_notes = admin_notes
        submission.save(update_fields=['status', 'admin_notes'])
        if new_status and submission.submitted_by:
            status_labels = {
                'approved': 'Acknowledged ✓',
                'rejected': 'Rejected',
                'revision_requested': 'Revision Requested',
                'reviewed': 'Under Review',
            }
            label = status_labels.get(new_status, new_status.replace('_', ' ').title())
            msg = f'Your report "{submission.title[:60]}" has been updated to: {label}.'
            if admin_notes:
                msg += f' Note from admin: {admin_notes[:120]}'
            _notify_submitter(submission, title=f'Report Update: {label}', message=msg)
        serializer = SubmissionDetailSerializer(submission, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='approve', permission_classes=[IsAuthenticated, IsAdminRole])
    def approve(self, request, pk=None):
        from django.utils import timezone
        submission = self.get_object()
        if submission.status not in ('pending', 'revision_requested'):
            return Response({'detail': 'Submission is not pending review.'}, status=status.HTTP_400_BAD_REQUEST)
        notes = request.data.get('admin_notes', '')
        submission.status = 'approved'
        submission.admin_notes = notes
        submission.reviewed_by = request.user
        submission.reviewed_at = timezone.now()
        submission.approved_at = timezone.now()
        submission.save(update_fields=['status', 'admin_notes', 'reviewed_by', 'reviewed_at', 'approved_at'])
        SubmissionReviewLog.objects.create(
            submission=submission, action='approved', notes=notes, actor=request.user
        )
        msg = f'Your accomplishment report "{submission.title[:60]}" has been approved.'
        if notes:
            msg += f' Admin notes: {notes[:120]}'
        _notify_submitter(submission, title='Report Approved ✓', message=msg)
        serializer = SubmissionDetailSerializer(submission, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='reject', permission_classes=[IsAuthenticated, IsAdminRole])
    def reject(self, request, pk=None):
        from django.utils import timezone
        submission = self.get_object()
        if submission.status not in ('pending', 'revision_requested'):
            return Response({'detail': 'Submission is not pending review.'}, status=status.HTTP_400_BAD_REQUEST)
        notes = request.data.get('admin_notes', '')
        submission.status = 'rejected'
        submission.admin_notes = notes
        submission.reviewed_by = request.user
        submission.reviewed_at = timezone.now()
        submission.save(update_fields=['status', 'admin_notes', 'reviewed_by', 'reviewed_at'])
        SubmissionReviewLog.objects.create(
            submission=submission, action='rejected', notes=notes, actor=request.user
        )
        msg = f'Your accomplishment report "{submission.title[:60]}" was not approved.'
        if notes:
            msg += f' Reason: {notes[:120]}'
        _notify_submitter(submission, title='Report Not Approved', message=msg)
        serializer = SubmissionDetailSerializer(submission, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='request-revision', permission_classes=[IsAuthenticated, IsAdminRole])
    def request_revision(self, request, pk=None):
        submission = self.get_object()
        if submission.status != 'pending':
            return Response({'detail': 'Submission is not pending review.'}, status=status.HTTP_400_BAD_REQUEST)
        notes = request.data.get('revision_notes', '')
        submission.status = 'revision_requested'
        submission.revision_notes = notes
        submission.save(update_fields=['status', 'revision_notes'])
        SubmissionReviewLog.objects.create(
            submission=submission, action='revision_requested', notes=notes, actor=request.user
        )
        msg = f'Your accomplishment report "{submission.title[:60]}" needs revision before it can be approved.'
        if notes:
            msg += f' What to revise: {notes[:120]}'
        _notify_submitter(submission, title='Revision Requested', message=msg)
        serializer = SubmissionDetailSerializer(submission, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='mark-in-progress')
    def mark_in_progress(self, request, pk=None):
        submission = self.get_object()
        if submission.submitted_by != request.user:
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        if submission.status != 'approved':
            return Response({'detail': 'Submission must be approved first.'}, status=status.HTTP_400_BAD_REQUEST)
        submission.status = 'in_progress'
        submission.save(update_fields=['status'])
        SubmissionReviewLog.objects.create(
            submission=submission,
            action='in_progress_marked',
            notes='Marked as in progress.',
            actor=request.user,
        )
        serializer = SubmissionDetailSerializer(submission, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='submit-completion')
    def submit_completion(self, request, pk=None):
        from django.utils import timezone
        submission = self.get_object()
        if submission.submitted_by != request.user:
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        if submission.status != 'in_progress':
            return Response({'detail': 'Submission must be in progress.'}, status=status.HTTP_400_BAD_REQUEST)
        serializer = CompletionReportSerializer(
            submission, data=request.data, partial=True, context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(status='completion_submitted')
        SubmissionReviewLog.objects.create(
            submission=submission,
            action='completion_submitted',
            notes='Completion report submitted.',
            actor=request.user,
        )
        submitter_name = getattr(request.user, 'full_name', None) or request.user.email
        _notify_admins(
            title=f'Completion Report Filed: {submission.title[:55]}',
            message=(
                f'{submitter_name} filed a completion report for '
                f'"{submission.title[:60]}" and is awaiting final approval.'
            ),
        )
        detail_serializer = SubmissionDetailSerializer(submission, context={'request': request})
        return Response(detail_serializer.data)

    @action(detail=True, methods=['post'], url_path='complete', permission_classes=[IsAuthenticated, IsAdminRole])
    def complete(self, request, pk=None):
        from django.utils import timezone
        submission = self.get_object()
        if submission.status != 'completion_submitted':
            return Response({'detail': 'Completion report not submitted yet.'}, status=status.HTTP_400_BAD_REQUEST)
        notes = request.data.get('admin_notes', '')
        submission.status = 'completed'
        submission.admin_notes = notes
        submission.completed_at = timezone.now()
        submission.save(update_fields=['status', 'admin_notes', 'completed_at'])
        SubmissionReviewLog.objects.create(
            submission=submission, action='completed', notes=notes, actor=request.user
        )
        msg = f'Congratulations! Your project "{submission.title[:60]}" has been officially marked as completed.'
        if notes:
            msg += f' Admin notes: {notes[:120]}'
        _notify_submitter(submission, title='Project Completed 🎉', message=msg)
        serializer = SubmissionDetailSerializer(submission, context={'request': request})
        return Response(serializer.data)

    # ── Descriptive Report Generation ─────────────────────────────────────────

    @action(
        detail=False,
        methods=['get'],
        url_path='report',
        permission_classes=[IsAuthenticated, IsAdminRole],
    )
    def generate_report(self, request):
        """
        Generate a descriptive accomplishment report for a given period.

        Query params:
          period   : 'monthly' | 'quarterly' | 'annual'  (default: monthly)
          year     : int  (default: current year)
          month    : int  1-12  (required for period=monthly)
          quarter  : int  1-4   (required for period=quarterly)
          barangay : str  (optional filter)
          category : str  (optional filter)
          status   : str  (optional, default includes 'approved','completed','in_progress','completion_submitted')
        """
        from django.db.models import Sum, Count, Q
        from django.utils import timezone as tz
        import calendar

        period  = request.query_params.get('period', 'monthly')
        year    = int(request.query_params.get('year', tz.now().year))
        month   = int(request.query_params.get('month', tz.now().month))
        quarter = int(request.query_params.get('quarter', (tz.now().month - 1) // 3 + 1))
        barangay = request.query_params.get('barangay', '').strip()
        category = request.query_params.get('category', '').strip()

        # ── Date range ─────────────────────────────────────────────────────────
        if period == 'annual':
            date_from = f'{year}-01-01'
            date_to   = f'{year}-12-31'
            period_label = f'Full Year {year}'
        elif period == 'quarterly':
            qm_start = (quarter - 1) * 3 + 1
            qm_end   = qm_start + 2
            last_day = calendar.monthrange(year, qm_end)[1]
            date_from = f'{year}-{qm_start:02d}-01'
            date_to   = f'{year}-{qm_end:02d}-{last_day:02d}'
            q_names   = {1: 'Q1 (Jan–Mar)', 2: 'Q2 (Apr–Jun)', 3: 'Q3 (Jul–Sep)', 4: 'Q4 (Oct–Dec)'}
            period_label = f'{q_names[quarter]} {year}'
        else:  # monthly
            last_day = calendar.monthrange(year, month)[1]
            date_from = f'{year}-{month:02d}-01'
            date_to   = f'{year}-{month:02d}-{last_day:02d}'
            period_label = f'{calendar.month_name[month]} {year}'

        qs = ProgramSubmission.objects.filter(
            submitted_at__date__gte=date_from,
            submitted_at__date__lte=date_to,
            status__in=['approved', 'completed', 'in_progress', 'completion_submitted', 'pending'],
        )
        if barangay:
            qs = qs.filter(barangay__icontains=barangay)
        if category:
            qs = qs.filter(category=category)

        total = qs.count()
        approved  = qs.filter(status__in=['approved', 'in_progress', 'completion_submitted', 'completed']).count()
        completed = qs.filter(status='completed').count()
        pending   = qs.filter(status='pending').count()

        agg = qs.aggregate(
            total_male=Sum('male_participants'),
            total_female=Sum('female_participants'),
            total_lgbtq=Sum('lgbtq_participants'),
            total_prefer_not_say=Sum('prefer_not_say_participants'),
            total_expected=Sum('expected_participants'),
            total_budget=Sum('estimated_budget'),
        )
        total_male           = agg['total_male'] or 0
        total_female         = agg['total_female'] or 0
        total_lgbtq          = agg['total_lgbtq'] or 0
        total_prefer_not_say = agg['total_prefer_not_say'] or 0
        total_youth          = total_male + total_female
        total_budget         = float(agg['total_budget'] or 0)

        # ── Breakdowns ──────────────────────────────────────────────────────────
        by_category = list(
            qs.values('category').annotate(count=Count('id')).order_by('-count')
        )
        # Resolve display labels
        cat_map = dict(ProgramSubmission._meta.get_field('category').choices)
        for item in by_category:
            item['label'] = cat_map.get(item['category'], item['category'])

        by_barangay = list(
            qs.exclude(barangay='').values('barangay').annotate(count=Count('id')).order_by('-count')[:10]
        )

        by_type = list(
            qs.values('submitter_type').annotate(count=Count('id'))
        )

        # ── Barangays with submissions ─────────────────────────────────────────
        barangay_count = qs.exclude(barangay='').values('barangay').distinct().count()

        # ── Auto-generated narrative ───────────────────────────────────────────
        top_cat_label = by_category[0]['label'] if by_category else 'various sectors'
        top_brgy      = by_barangay[0]['barangay'] if by_barangay else None

        narrative_parts = [
            f"In {period_label}, a total of {total} accomplishment report{'s' if total != 1 else ''} "
            f"{'were' if total != 1 else 'was'} submitted",
        ]
        if barangay:
            narrative_parts[0] += f" from Barangay {barangay}"
        elif barangay_count > 0:
            narrative_parts[0] += f" across {barangay_count} barangay{'s' if barangay_count != 1 else ''}"
        narrative_parts[0] += " in Lucena City."

        if approved:
            narrative_parts.append(
                f"Of these, {approved} {'were' if approved != 1 else 'was'} approved or in progress"
                + (f", and {completed} {'have' if completed != 1 else 'has'} been completed." if completed else ".")
            )

        if total_youth > 0:
            narrative_parts.append(
                f"Programs served a combined total of {total_youth:,} youth participants "
                f"({total_male:,} male, {total_female:,} female)."
            )

        if by_category:
            narrative_parts.append(
                f"The most active program category was {top_cat_label}, "
                f"accounting for {by_category[0]['count']} submission{'s' if by_category[0]['count'] != 1 else ''}."
            )

        if total_budget > 0:
            narrative_parts.append(
                f"The combined estimated program budget for the period totalled ₱{total_budget:,.2f}."
            )

        if top_brgy and not barangay:
            narrative_parts.append(
                f"The most active barangay was {top_brgy} with {by_barangay[0]['count']} submission{'s' if by_barangay[0]['count'] != 1 else ''}."
            )

        if pending:
            narrative_parts.append(
                f"As of this report, {pending} submission{'s' if pending != 1 else ''} {'are' if pending != 1 else 'is'} still pending admin review."
            )

        narrative = ' '.join(narrative_parts)

        return Response({
            'period_label': period_label,
            'period': period,
            'year': year,
            'filters': {'barangay': barangay, 'category': category},
            'summary': {
                'total_submissions': total,
                'approved': approved,
                'completed': completed,
                'pending': pending,
                'total_male_participants': total_male,
                'total_female_participants': total_female,
                'total_lgbtq_participants': total_lgbtq,
                'total_prefer_not_say_participants': total_prefer_not_say,
                'total_participants': total_youth,
                'total_budget': total_budget,
                'barangays_reached': barangay_count,
            },
            'by_category': by_category,
            'by_barangay': by_barangay,
            'by_submitter_type': by_type,
            'narrative': narrative,
        })


# ---------------------------------------------------------------------------
# FeaturedSlideViewSet
# ---------------------------------------------------------------------------

class FeaturedSlideViewSet(viewsets.ModelViewSet):
    """
    list / retrieve : public — active slides only for anonymous users.
    create / update / destroy : admin only.
    """
    serializer_class = FeaturedSlideSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        qs = FeaturedSlide.objects.all()
        # Non-admin users only see active slides
        if not (self.request.user and self.request.user.is_authenticated
                and self.request.user.role in ('lgu_admin', 'super_admin')):
            qs = qs.filter(is_active=True)
        return qs

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [AllowAny()]
        return [IsAuthenticated(), IsAdminRole()]

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsAdminRole],
            url_path='move-up')
    def move_up(self, request, pk=None):
        slide = self.get_object()
        prev = FeaturedSlide.objects.filter(order__lt=slide.order).order_by('-order').first()
        if prev:
            slide.order, prev.order = prev.order, slide.order
            FeaturedSlide.objects.bulk_update([slide, prev], ['order'])
        return Response({'status': 'ok'})

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsAdminRole],
            url_path='move-down')
    def move_down(self, request, pk=None):
        slide = self.get_object()
        nxt = FeaturedSlide.objects.filter(order__gt=slide.order).order_by('order').first()
        if nxt:
            slide.order, nxt.order = nxt.order, slide.order
            FeaturedSlide.objects.bulk_update([slide, nxt], ['order'])
        return Response({'status': 'ok'})


# ---------------------------------------------------------------------------
# SubmissionAttachmentViewSet
# ---------------------------------------------------------------------------

class SubmissionAttachmentViewSet(viewsets.ModelViewSet):
    serializer_class = SubmissionAttachmentSerializer
    http_method_names = ['get', 'post', 'delete', 'head', 'options']

    def get_queryset(self):
        submission_pk = self.kwargs.get('submission_pk')
        return SubmissionAttachment.objects.filter(submission_id=submission_pk)

    def perform_create(self, serializer):
        submission_pk = self.kwargs.get('submission_pk')
        submission = get_object_or_404(ProgramSubmission, pk=submission_pk)
        if submission.submitted_by != self.request.user and not IsAdminRole().has_permission(self.request, self):
            raise PermissionDenied("Forbidden.")
        serializer.save(submission=submission, uploaded_by=self.request.user)

    def get_permissions(self):
        return [IsAuthenticated()]
