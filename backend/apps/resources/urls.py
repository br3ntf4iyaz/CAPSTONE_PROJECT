from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import ResourceViewSet

# The router is included under  path("api/resources/", ...)  in config/urls.py,
# so register at the empty prefix so the list endpoint is  /api/resources/
# and detail is  /api/resources/{pk}/
router = DefaultRouter()
router.register(r'', ResourceViewSet, basename='resource')

urlpatterns = [
    path('', include(router.urls)),
]
