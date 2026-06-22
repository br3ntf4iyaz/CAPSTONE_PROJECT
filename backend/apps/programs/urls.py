from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_nested import routers as nested_routers

from .views import FeaturedSlideViewSet, ProgramSubmissionViewSet, SubmissionAttachmentViewSet, YouthProgramViewSet

router = DefaultRouter()
router.register(r'slides', FeaturedSlideViewSet, basename='featured-slide')
router.register(r'submissions', ProgramSubmissionViewSet, basename='program-submission')
router.register(r'', YouthProgramViewSet, basename='program')

submissions_router = nested_routers.NestedDefaultRouter(router, r'submissions', lookup='submission')
submissions_router.register(r'attachments', SubmissionAttachmentViewSet, basename='submission-attachment')

urlpatterns = [
    path('', include(router.urls)),
    path('', include(submissions_router.urls)),
]
