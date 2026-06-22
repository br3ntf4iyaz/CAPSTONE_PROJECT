from rest_framework.routers import DefaultRouter
from .views import CommunityPostViewSet

router = DefaultRouter()
router.register(r'posts', CommunityPostViewSet, basename='community-post')
urlpatterns = router.urls
