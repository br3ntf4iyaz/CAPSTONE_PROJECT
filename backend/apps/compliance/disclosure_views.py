import datetime as dt

from django.db import transaction
from django.http import Http404
from django.utils import timezone
from rest_framework import serializers, status, viewsets
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import AuditLog
from apps.accounts.permissions import IsAdminRole
from apps.accounts.uploads import OFFICE_EXTS, check_upload, private_file_response

from . import disclosure
from .models import DisclosureRequirement, DisclosureSubmission

MAX_UPLOAD = 15 * 1024 * 1024  # 15 MB
FIRST_YEAR = 2020


def _year_param(request):
    today = timezone.localdate()
    try:
        year = int(request.query_params.get('year', today.year))
    except (TypeError, ValueError):
        year = today.year
    return min(max(year, FIRST_YEAR), today.year + 1)


def _audit(request, action, obj, **details):
    AuditLog.objects.create(user=request.user, action=action, model_name=obj.__class__.__name__, object_id=obj.pk, details=details)


class RequirementSerializer(serializers.ModelSerializer):
    class Meta:
        model = DisclosureRequirement
        fields = ['id', 'title', 'description', 'frequency', 'deadline_month', 'deadline_day', 'order', 'is_active']

    def validate(self, attrs):
        freq = attrs.get('frequency', getattr(self.instance, 'frequency', 'quarterly'))
        month = attrs.get('deadline_month', getattr(self.instance, 'deadline_month', None))
        day = attrs.get('deadline_day', getattr(self.instance, 'deadline_day', None))
        if freq == 'quarterly':
            attrs['deadline_month'] = attrs['deadline_day'] = None  # quarterly deadlines are fixed
        elif month or day:
            if not (month and day) or not (1 <= month <= 12) or not (1 <= day <= 31):
                raise serializers.ValidationError('Give a valid month (1-12) and day for the yearly deadline, or leave both empty.')
        return attrs


class RequirementViewSet(viewsets.ModelViewSet):
    """The FPDPB checklist items. Administrators only. Deleting only switches an item off, so history is kept."""
    permission_classes = [IsAuthenticated, IsAdminRole]
    serializer_class = RequirementSerializer
    pagination_class = None
    queryset = DisclosureRequirement.objects.all()

    def perform_create(self, serializer):
        obj = serializer.save()
        _audit(self.request, 'disclosure_requirement_created', obj, title=obj.title)

    def perform_update(self, serializer):
        obj = serializer.save()
        _audit(self.request, 'disclosure_requirement_updated', obj, title=obj.title, active=obj.is_active)

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=['is_active'])
        _audit(self.request, 'disclosure_requirement_deactivated', instance, title=instance.title)


class OverviewView(APIView):
    """GET /compliance/disclosure/overview/?year=2026 : the checklist, status of every period, and the summary counts."""
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        today = timezone.localdate()
        year = _year_param(request)
        reqs = list(DisclosureRequirement.objects.filter(is_active=True))
        data = disclosure.build_overview(reqs, DisclosureSubmission.objects.all(), year, today)
        data['years'] = list(range(today.year + 1, FIRST_YEAR - 1, -1))
        return Response(data)


class SubmissionCreateSerializer(serializers.Serializer):
    requirement = serializers.PrimaryKeyRelatedField(queryset=DisclosureRequirement.objects.filter(is_active=True))
    year = serializers.IntegerField(min_value=FIRST_YEAR)
    quarter = serializers.IntegerField(required=False, allow_null=True, min_value=1, max_value=4)
    title = serializers.CharField(max_length=255, required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True, max_length=3000)
    file = serializers.FileField()

    def validate(self, attrs):
        req = attrs['requirement']
        today = timezone.localdate()
        if attrs['year'] > today.year + 1:
            raise serializers.ValidationError({'year': 'That year is too far ahead.'})
        if req.frequency == 'quarterly':
            if not attrs.get('quarter'):
                raise serializers.ValidationError({'quarter': 'Choose the quarter this document belongs to.'})
        else:
            attrs['quarter'] = None
        check_upload(attrs['file'], OFFICE_EXTS, MAX_UPLOAD, field='file')
        return attrs


class SubmissionCreateView(APIView):
    """POST /compliance/disclosure/submissions/ : upload a document for one period (administrators). It is NOT completed
    until an administrator verifies it."""
    permission_classes = [IsAuthenticated, IsAdminRole]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        ser = SubmissionCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        req = d['requirement']
        label = f"{req.title} - {d['year']}" + (f" Q{d['quarter']}" if d.get('quarter') else '')
        sub = DisclosureSubmission.objects.create(
            requirement=req, year=d['year'], quarter=d.get('quarter'), title=(d.get('title') or '').strip() or label,
            description=d.get('description', ''), file=d['file'], original_name=getattr(d['file'], 'name', '')[:255],
            uploaded_by=request.user)
        _audit(request, 'disclosure_uploaded', sub, requirement=req.title, year=sub.year, quarter=sub.quarter)
        return Response(disclosure.submission_data(sub), status=status.HTTP_201_CREATED)


class SubmissionReviewView(APIView):
    """POST /compliance/disclosure/submissions/<id>/verify/ or /reject/ : only an administrator can complete a period."""
    permission_classes = [IsAuthenticated, IsAdminRole]
    decision = 'verify'

    @transaction.atomic
    def post(self, request, pk):
        try:
            sub = DisclosureSubmission.objects.select_for_update().get(pk=pk)
        except DisclosureSubmission.DoesNotExist:
            raise Http404
        note = str(request.data.get('note', '')).strip()[:2000]
        if self.decision == 'reject':
            if not note:
                return Response({'note': 'Say why the document is rejected.'}, status=status.HTTP_400_BAD_REQUEST)
            sub.status = 'rejected'
        else:
            sub.status = 'verified'
            public = request.data.get('is_public', sub.is_public)
            sub.is_public = str(public).lower() not in ('false', '0', 'no')
        sub.verified_by, sub.verified_at, sub.review_note = request.user, timezone.now(), note
        sub.save()
        _audit(request, f'disclosure_{sub.status}', sub, requirement=sub.requirement.title, year=sub.year, quarter=sub.quarter)
        return Response(disclosure.submission_data(sub))


class SubmissionVisibilityView(APIView):
    """POST /compliance/disclosure/submissions/<id>/visibility/ {is_public}: show or hide a verified document from the public."""
    permission_classes = [IsAuthenticated, IsAdminRole]

    def post(self, request, pk):
        sub = DisclosureSubmission.objects.filter(pk=pk).first()
        if sub is None:
            raise Http404
        sub.is_public = str(request.data.get('is_public', True)).lower() not in ('false', '0', 'no')
        sub.save(update_fields=['is_public'])
        _audit(request, 'disclosure_visibility', sub, is_public=sub.is_public)
        return Response(disclosure.submission_data(sub))


class SubmissionFileView(APIView):
    """GET the uploaded file. Administrators can open any upload. Everyone else only a verified, public one."""
    permission_classes = [AllowAny]

    def get(self, request, pk):
        sub = DisclosureSubmission.objects.filter(pk=pk).first()
        if sub is None:
            raise Http404
        is_admin = IsAdminRole().has_permission(request, self)
        if not is_admin and not (sub.status == 'verified' and sub.is_public):
            raise Http404
        return private_file_response(sub.file)


class PublicDisclosureView(APIView):
    """GET /compliance/disclosure/public/?year= : the documents anyone may read (verified and public). No sign-in."""
    permission_classes = [AllowAny]

    def get(self, request):
        qs = (DisclosureSubmission.objects.filter(status='verified', is_public=True, requirement__is_active=True)
              .select_related('requirement').order_by('-year', '-quarter', '-verified_at'))
        year = request.query_params.get('year')
        if year and year.isdigit():
            qs = qs.filter(year=int(year))
        items = []
        for s in qs[:500]:
            label = disclosure.QUARTERS[s.quarter]['label'] if s.quarter else f'Year {s.year}'
            deadline = (disclosure.quarter_deadline(s.year, s.quarter) if s.quarter else None)
            items.append({
                'id': s.id, 'requirement': s.requirement.title, 'title': s.title, 'description': s.description,
                'year': s.year, 'quarter': s.quarter, 'period': label, 'deadline': deadline, 'verified_at': s.verified_at,
                'filename': s.original_name or s.file.name.rsplit('/', 1)[-1],
                'download': f'/api/compliance/disclosure/files/{s.id}/',
            })
        years = sorted({i['year'] for i in items}, reverse=True)
        return Response({'years': years, 'items': items})
