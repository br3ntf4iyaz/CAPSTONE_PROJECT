from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    AnnouncementViewSet,
    BadgeViewSet,
    CertificateViewSet,
    LeaderboardView,
    UserBadgeViewSet,
)

router = DefaultRouter()
router.register(r'badges', BadgeViewSet, basename='badge')
router.register(r'user-badges', UserBadgeViewSet, basename='user-badge')
router.register(r'certificates', CertificateViewSet, basename='certificate')
router.register(r'announcements', AnnouncementViewSet, basename='announcement')

urlpatterns = [
    path('', include(router.urls)),
    path('leaderboard/', LeaderboardView.as_view(), name='leaderboard'),
]
