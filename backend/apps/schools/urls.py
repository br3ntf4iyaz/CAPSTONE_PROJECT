from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    ProgramViewSet,
    RecommendSchoolsView,
    SchoolBookmarkViewSet,
    SchoolComparisonView,
    SchoolViewSet,
)

# Specific prefixes MUST be registered before r'' so that Django's URL resolver
# matches e.g. /programs/ and /bookmarks/ as their own viewsets rather than
# treating them as a School pk lookup (which returns 404).
router = DefaultRouter()
router.register(r'bookmarks', SchoolBookmarkViewSet, basename='school-bookmark')
router.register(r'programs', ProgramViewSet, basename='program')
router.register(r'', SchoolViewSet, basename='school')

urlpatterns = [
    # Standalone paths MUST come before router.urls so the router's
    # ^(?P<pk>[^/.]+)/$ detail pattern does not swallow them.
    path('compare/', SchoolComparisonView.as_view(), name='school-comparison'),
    path('recommend/', RecommendSchoolsView.as_view(), name='school-recommend'),
    path('', include(router.urls)),
]
