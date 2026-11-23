from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .scholarship_views import ScholarshipApplicationViewSet
from .views import ApplicationViewSet

scholarship_router = DefaultRouter()
scholarship_router.register(r'', ScholarshipApplicationViewSet, basename='scholarship-application')

router = DefaultRouter()
router.register(r'', ApplicationViewSet, basename='application')

# the scholarship routes must come before the catch-all router
urlpatterns = [path('scholarship/', include(scholarship_router.urls))] + router.urls
