from django.urls import path

from .views import (
    AuditDaysView,
    CertificateIntegrityView,
    IDVerificationIntegrityView,
    LedgerStatusView,
    ReviewLogIntegrityView,
    SKRequirementIntegrityView,
)

urlpatterns = [
    path('status/', LedgerStatusView.as_view(), name='ledger-status'),
    path('review-logs/<int:submission_id>/', ReviewLogIntegrityView.as_view(), name='ledger-review-logs'),
    path('sk-requirements/', SKRequirementIntegrityView.as_view(), name='ledger-sk-requirements'),
    path('id-verifications/', IDVerificationIntegrityView.as_view(), name='ledger-id-verifications'),
    path('certificates/', CertificateIntegrityView.as_view(), name='ledger-certificates'),
    path('audit-days/', AuditDaysView.as_view(), name='ledger-audit-days'),
]
