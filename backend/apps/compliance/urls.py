from django.urls import include, path
from rest_framework.routers import DefaultRouter

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

urlpatterns = [
    path('', include(router.urls)),
    path('summary/', ComplianceSummaryView.as_view(), name='compliance-summary'),
]
