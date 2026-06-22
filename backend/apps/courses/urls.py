from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CertificateViewSet,
    CourseAdminViewSet,
    CourseViewSet,
    EnrollmentViewSet,
    LessonViewSet,
    QuizAttemptViewSet,
)

# Sub-resource prefixes MUST be registered before r'' so that Django matches
# e.g. /enrollments/ before the CourseViewSet detail pattern ^(?P<pk>[^/.]+)/$.
router = DefaultRouter()
router.register(r"enrollments", EnrollmentViewSet, basename="enrollment")
router.register(r"certificates", CertificateViewSet, basename="certificate")
router.register(r"quiz-attempts", QuizAttemptViewSet, basename="quiz-attempt")
router.register(r"lessons", LessonViewSet, basename="lesson")
router.register(r"admin/courses", CourseAdminViewSet, basename="admin-course")
router.register(r"", CourseViewSet, basename="course")

urlpatterns = [
    path("", include(router.urls)),
]
