from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import SKBarangayViewSet, SKFeedbackViewSet, SKRequirementViewSet

router = DefaultRouter()
router.register(r'barangays', SKBarangayViewSet, basename='sk-barangay')
router.register(r'requirements', SKRequirementViewSet, basename='sk-requirement')
router.register(r'feedback', SKFeedbackViewSet, basename='sk-feedback')

urlpatterns = [
    path('', include(router.urls)),
]
