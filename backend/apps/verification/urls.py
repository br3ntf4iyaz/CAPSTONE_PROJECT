from django.urls import path
from .views import (
    VerificationStatusView,
    VerificationSubmitView,
    AdminVerificationListView,
    AdminVerificationDetailView,
    AdminVerificationBulkView,
)

urlpatterns = [
    path("",             VerificationStatusView.as_view(),    name="verification-status"),
    path("submit/",      VerificationSubmitView.as_view(),    name="verification-submit"),
    path("admin/",       AdminVerificationListView.as_view(), name="verification-admin-list"),
    path("admin/bulk/",  AdminVerificationBulkView.as_view(), name="verification-admin-bulk"),
    path("admin/<int:pk>/", AdminVerificationDetailView.as_view(), name="verification-admin-detail"),
]
