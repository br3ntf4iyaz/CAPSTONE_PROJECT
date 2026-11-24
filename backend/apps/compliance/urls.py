from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .disclosure_views import (
    OverviewView, PublicDisclosureView, RequirementViewSet, SubmissionCreateView, SubmissionFileView, SubmissionReviewView,
    SubmissionVisibilityView,
)
from .sk_views import (
    OverviewView as SKOverviewView, PublicFileView, PublicListView, QueueView, RecordCreateView, RecordFileView, RecordReviewView,
    SlotsView as SKSlotsView,
)
from .views import (
    ComplianceRecordViewSet, ComplianceReportViewSet, ComplianceSummaryView,
    SKMEComplianceViewSet, SKDocumentSubmissionViewSet, SKAssemblyRecordViewSet,
)

router = DefaultRouter()
router.register(r'records', ComplianceRecordViewSet, basename='compliance-record')
router.register(r'reports', ComplianceReportViewSet, basename='compliance-report')
router.register(r'sk-me', SKMEComplianceViewSet, basename='sk-me')
router.register(r'sk-documents', SKDocumentSubmissionViewSet, basename='sk-documents')
router.register(r'sk-assembly', SKAssemblyRecordViewSet, basename='sk-assembly')
router.register(r'disclosure/requirements', RequirementViewSet, basename='disclosure-requirement')

urlpatterns = [
    path('', include(router.urls)),
    path('summary/', ComplianceSummaryView.as_view(), name='compliance-summary'),
    path('disclosure/overview/', OverviewView.as_view(), name='disclosure-overview'),
    path('disclosure/submissions/', SubmissionCreateView.as_view(), name='disclosure-submit'),
    path('disclosure/submissions/<int:pk>/verify/', SubmissionReviewView.as_view(decision='verify'), name='disclosure-verify'),
    path('disclosure/submissions/<int:pk>/reject/', SubmissionReviewView.as_view(decision='reject'), name='disclosure-reject'),
    path('disclosure/submissions/<int:pk>/visibility/', SubmissionVisibilityView.as_view(), name='disclosure-visibility'),
    path('disclosure/files/<int:pk>/', SubmissionFileView.as_view(), name='disclosure-file'),
    path('disclosure/public/', PublicDisclosureView.as_view(), name='disclosure-public'),

    # SK Compliance Monitoring System
    path('sk/overview/', SKOverviewView.as_view(), name='sk-compliance-overview'),
    path('sk/slots/', SKSlotsView.as_view(), name='sk-compliance-slots'),
    path('sk/queue/', QueueView.as_view(), name='sk-compliance-queue'),
    path('sk/records/', RecordCreateView.as_view(), name='sk-compliance-submit'),
    path('sk/records/<int:pk>/review/', RecordReviewView.as_view(), name='sk-compliance-review'),
    path('sk/records/<int:pk>/file/', RecordFileView.as_view(), name='sk-compliance-file'),
    # FPDPB: the public face. Published documents only.
    path('fpdpb/public/', PublicListView.as_view(), name='fpdpb-public'),
    path('fpdpb/files/<int:pk>/', PublicFileView.as_view(), name='fpdpb-file'),
]
