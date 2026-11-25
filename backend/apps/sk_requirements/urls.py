from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .config_views import ConfigViewSet, DeadlineViewSet
from .views import SKBarangayViewSet, SKFeedbackViewSet, SKMemberViewSet, SKRequirementViewSet

router = DefaultRouter()
router.register(r'barangays', SKBarangayViewSet, basename='sk-barangay')
router.register(r'members', SKMemberViewSet, basename='sk-member')
router.register(r'requirements', SKRequirementViewSet, basename='sk-requirement')
router.register(r'feedback', SKFeedbackViewSet, basename='sk-feedback')
router.register(r'config', ConfigViewSet, basename='sk-config')
router.register(r'deadlines', DeadlineViewSet, basename='sk-deadline')

urlpatterns = [
    path('', include(router.urls)),
]
