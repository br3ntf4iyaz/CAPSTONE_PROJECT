from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import InternshipApplicationViewSet, InternshipViewSet

# applications/ must be registered before r'' to avoid being caught as internship pk.
router = DefaultRouter()
router.register(r"applications", InternshipApplicationViewSet, basename="internship-application")
router.register(r"", InternshipViewSet, basename="internship")

urlpatterns = [
    path("", include(router.urls)),
]
