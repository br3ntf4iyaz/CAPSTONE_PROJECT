from django.contrib.auth import get_user_model
from django.db.models import Sum
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdminRole, IsAdminOrLGU

from .models import ComplianceRecord, ComplianceReport, SKMECompliance, SKDocumentSubmission, SKAssemblyRecord, BARANGAY_KEYS
from .serializers import ComplianceRecordSerializer, ComplianceReportSerializer, SKMEComplianceSerializer, SKDocumentSubmissionSerializer, SKAssemblyRecordSerializer

User = get_user_model()


class ComplianceRecordViewSet(viewsets.ModelViewSet):
    """
    list   – admin sees all (filterable by user/barangay/date/type); youth sees own records
    create – admin only
    retrieve/update/destroy – admin only
    """

    serializer_class = ComplianceRecordSerializer
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['recorded_at', 'value']
    ordering = ['-recorded_at']

    def get_queryset(self):
        user = self.request.user
        role = getattr(user, 'role', None)

        if role in ('lgu_admin', 'super_admin'):
            qs = ComplianceRecord.objects.select_related('user', 'recorded_by').all()

            # Filter by target user
            target_user_id = self.request.query_params.get('user_id')
            if target_user_id:
                qs = qs.filter(user_id=target_user_id)

            # Filter by barangay (via user profile – falls back to username search if no barangay field)
            barangay = self.request.query_params.get('barangay')
            if barangay:
                qs = qs.filter(user__profile__barangay__icontains=barangay)

            # Filter by record_type
            record_type = self.request.query_params.get('record_type')
            if record_type:
                qs = qs.filter(record_type=record_type)

            # Date range filters
            date_from = self.request.query_params.get('date_from')
            if date_from:
                qs = qs.filter(recorded_at__date__gte=date_from)

            date_to = self.request.query_params.get('date_to')
            if date_to:
                qs = qs.filter(recorded_at__date__lte=date_to)

            return qs

        # Youth sees only their own records
        return ComplianceRecord.objects.filter(user=user).select_related('recorded_by')

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAuthenticated(), IsAdminRole()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save(recorded_by=self.request.user)


class ComplianceSummaryView(APIView):
    """
    GET – per-user compliance scores aggregated by record_type.
    Filterable by barangay and date range. Intended for LGU admin.
    """

    permission_classes = [IsAuthenticated, IsAdminOrLGU]

    def get(self, request):
        qs = ComplianceRecord.objects.select_related('user')

        barangay = request.query_params.get('barangay')
        if barangay:
            qs = qs.filter(user__profile__barangay__icontains=barangay)

        date_from = request.query_params.get('date_from')
        if date_from:
            qs = qs.filter(recorded_at__date__gte=date_from)

        date_to = request.query_params.get('date_to')
        if date_to:
            qs = qs.filter(recorded_at__date__lte=date_to)

        # Aggregate total value per user per record_type
        from django.db.models import Count
        aggregated = (
            qs.values('user__id', 'user__first_name', 'user__last_name', 'user__email', 'record_type')
            .annotate(total_value=Sum('value'), record_count=Count('id'))
            .order_by('user__last_name', 'record_type')
        )

        # Group by user
        user_map = {}
        for row in aggregated:
            uid = row['user__id']
            if uid not in user_map:
                user_map[uid] = {
                    'user_id': uid,
                    'name': f"{row['user__first_name']} {row['user__last_name']}".strip(),
                    'email': row['user__email'],
                    'total_score': 0,
                    'breakdown': [],
                }
            user_map[uid]['breakdown'].append({
                'record_type': row['record_type'],
                'total_value': row['total_value'],
                'record_count': row['record_count'],
            })
            user_map[uid]['total_score'] += row['total_value']

        results = sorted(user_map.values(), key=lambda u: -u['total_score'])
        return Response({'count': len(results), 'results': results})


class ComplianceReportViewSet(viewsets.ModelViewSet):
    """
    list   – admin only; list generated reports
    create – admin only; auto-generates report data on creation
    retrieve/update/destroy – admin only
    """

    serializer_class = ComplianceReportSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]
    filter_backends = [filters.OrderingFilter]
    ordering = ['-created_at']

    def get_queryset(self):
        qs = ComplianceReport.objects.select_related('generated_by')

        report_type = self.request.query_params.get('report_type')
        if report_type:
            qs = qs.filter(report_type=report_type)

        barangay = self.request.query_params.get('barangay')
        if barangay:
            qs = qs.filter(barangay__icontains=barangay)

        return qs

    def perform_create(self, serializer):
        report = serializer.save(generated_by=self.request.user)
        # Auto-generate report data
        data = self._generate_report_data(report)
        report.data = data
        report.save(update_fields=['data'])

    def _generate_report_data(self, report):
        """Build summary data for the report based on its parameters."""
        from django.db.models import Count, Sum

        qs = ComplianceRecord.objects.filter(
            recorded_at__date__gte=report.date_from,
            recorded_at__date__lte=report.date_to,
        )

        if report.barangay:
            qs = qs.filter(user__profile__barangay__icontains=report.barangay)

        # Per-type summary
        type_summary = list(
            qs.values('record_type')
            .annotate(total_value=Sum('value'), record_count=Count('id'))
            .order_by('record_type')
        )

        # Per-user summary
        user_summary = list(
            qs.values('user__id', 'user__first_name', 'user__last_name', 'user__email')
            .annotate(total_value=Sum('value'), record_count=Count('id'))
            .order_by('-total_value')[:50]  # top 50
        )

        return {
            'date_from': str(report.date_from),
            'date_to': str(report.date_to),
            'barangay': report.barangay,
            'report_type': report.report_type,
            'type_summary': type_summary,
            'user_summary': [
                {
                    'user_id': row['user__id'],
                    'name': f"{row['user__first_name']} {row['user__last_name']}".strip(),
                    'email': row['user__email'],
                    'total_value': row['total_value'],
                    'record_count': row['record_count'],
                }
                for row in user_summary
            ],
            'total_records': qs.count(),
            'total_value': qs.aggregate(t=Sum('value'))['t'] or 0,
        }


def _ensure_barangay_records(model, year):
    """Auto-create records for all 33 barangays if missing for this year."""
    existing = set(model.objects.filter(year=year).values_list('barangay', flat=True))
    missing = [k for k in BARANGAY_KEYS if k not in existing]
    if missing:
        model.objects.bulk_create([model(barangay=k, year=year) for k in missing], ignore_conflicts=True)


class SKMEComplianceViewSet(viewsets.ModelViewSet):
    serializer_class = SKMEComplianceSerializer
    http_method_names = ['get', 'patch', 'head', 'options']

    def get_permissions(self):
        return [IsAuthenticated(), IsAdminRole()]

    def get_queryset(self):
        qs = SKMECompliance.objects.all()
        if self.action == 'list':
            year = int(self.request.query_params.get('year', 2025))
            _ensure_barangay_records(SKMECompliance, year)
            qs = qs.filter(year=year)
        return qs


class SKDocumentSubmissionViewSet(viewsets.ModelViewSet):
    serializer_class = SKDocumentSubmissionSerializer
    http_method_names = ['get', 'patch', 'head', 'options']

    def get_permissions(self):
        return [IsAuthenticated(), IsAdminRole()]

    def get_queryset(self):
        qs = SKDocumentSubmission.objects.all()
        if self.action == 'list':
            year = int(self.request.query_params.get('year', 2025))
            _ensure_barangay_records(SKDocumentSubmission, year)
            qs = qs.filter(year=year)
        return qs


class SKAssemblyRecordViewSet(viewsets.ModelViewSet):
    serializer_class = SKAssemblyRecordSerializer
    http_method_names = ['get', 'patch', 'head', 'options']

    def get_permissions(self):
        return [IsAuthenticated(), IsAdminRole()]

    def get_queryset(self):
        qs = SKAssemblyRecord.objects.all()
        if self.action == 'list':
            year = int(self.request.query_params.get('year', 2025))
            _ensure_barangay_records(SKAssemblyRecord, year)
            qs = qs.filter(year=year)
        return qs
