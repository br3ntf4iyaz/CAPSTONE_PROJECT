from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView, TokenBlacklistView
from .views import (
    LoginView, RegisterView, MeView, ProfileView,
    SkillViewSet, InterestViewSet, UserSkillView, UserInterestView,
    DocumentViewSet, ChangePasswordView, CompleteOnboardingView,
    UserAdminViewSet, VerifyEmailView, ResendVerificationView, GoogleAuthView,
    PersonalEventViewSet, ForgotPasswordView, ResetPasswordView,
    AuditLogListView, StatsView,
)

router = DefaultRouter()
router.register("skills", SkillViewSet, basename="skill")
router.register("interests", InterestViewSet, basename="interest")
router.register("documents", DocumentViewSet, basename="document")
router.register("admin/users", UserAdminViewSet, basename="admin-user")
router.register("personal-events", PersonalEventViewSet, basename="personal-event")

urlpatterns = [
    path("login/", LoginView.as_view(), name="login"),
    path("register/", RegisterView.as_view(), name="register"),
    path("verify-email/", VerifyEmailView.as_view(), name="verify-email"),
    path("resend-verification/", ResendVerificationView.as_view(), name="resend-verification"),
    path("forgot-password/", ForgotPasswordView.as_view(), name="forgot-password"),
    path("reset-password/", ResetPasswordView.as_view(), name="reset-password"),
    path("google/", GoogleAuthView.as_view(), name="google-auth"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("logout/", TokenBlacklistView.as_view(), name="logout"),
    path("me/", MeView.as_view(), name="me"),
    path("me/profile/", ProfileView.as_view(), name="profile"),
    path("me/skills/", UserSkillView.as_view(), name="user-skills"),
    path("me/interests/", UserInterestView.as_view(), name="user-interests"),
    path("me/change-password/", ChangePasswordView.as_view(), name="change-password"),
    path("me/complete-onboarding/", CompleteOnboardingView.as_view(), name="complete-onboarding"),
    path("admin/audit-logs/", AuditLogListView.as_view(), name="audit-logs"),
    path("stats/", StatsView.as_view(), name="stats"),
    path("", include(router.urls)),
]
