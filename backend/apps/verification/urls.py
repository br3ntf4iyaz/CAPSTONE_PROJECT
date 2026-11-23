from django.urls import path
from .views import (
    VerificationStatusView,
    VerificationSubmitView,
    AdminVerificationListView,
    AdminVerificationDetailView,
    AdminVerificationBulkView,
    AdminVerificationFileView,
)

urlpatterns = [
    path("",             VerificationStatusView.as_view(),    name="verification-status"),
    path("submit/",      VerificationSubmitView.as_view(),    name="verification-submit"),
    path("admin/",       AdminVerificationListView.as_view(), name="verification-admin-list"),
    path("admin/bulk/",  AdminVerificationBulkView.as_view(), name="verification-admin-bulk"),
    path("admin/<int:pk>/", AdminVerificationDetailView.as_view(), name="verification-admin-detail"),
    path("admin/<int:pk>/file/<str:which>/", AdminVerificationFileView.as_view(), name="verification-admin-file"),
]
