import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import EmailMultiAlternatives
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from .models import Profile, Skill, Interest, UserSkill, UserInterest, Document, AuditLog, EmailVerificationToken, PasswordResetToken
from .serializers import (
    RegisterSerializer, MeSerializer, ProfileSerializer,
    SkillSerializer, InterestSerializer, DocumentSerializer,
    ChangePasswordSerializer, UserAdminSerializer, AuditLogSerializer,
)
from .permissions import IsAdminRole, IsSuperAdmin

logger = logging.getLogger(__name__)

User = get_user_model()


def get_client_ip(request):
    x_forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded:
        return x_forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


# ---------------------------------------------------------------------------
# Email helpers
# ---------------------------------------------------------------------------

def _send_verification_email(user, token):
    """Send a branded verification email to the newly registered user."""
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
    verify_link = f"{frontend_url}/verify-email?token={token.token}"

    subject = "[LYDO] Verify your email address"
    text_body = (
        f"Hi {user.first_name},\n\n"
        f"Thanks for registering on the Lucena Youth Leadership Hub.\n\n"
        f"Please verify your email address by clicking the link below:\n\n"
        f"{verify_link}\n\n"
        f"This link expires in 24 hours.\n\n"
        f"If you did not register, you can safely ignore this email.\n\n"
        f"— LYDO Team"
    )
    html_body = f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="600" cellpadding="0" cellspacing="0"
             style="max-width:600px;background:#ffffff;border-radius:12px;
                    overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <tr>
          <td style="background:#0038a8;padding:24px 32px;">
            <p style="margin:0;color:#ffffff;font-size:13px;letter-spacing:.05em;
                      text-transform:uppercase;opacity:.8;">
              Lucena City Youth Development Office
            </p>
            <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;line-height:1.3;">
              Verify your email address
            </h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;color:#334155;font-size:15px;line-height:1.7;">
            <p style="margin:0 0 16px;">Hi <strong>{user.first_name}</strong>,</p>
            <p style="margin:0 0 24px;">
              Thanks for registering on the <strong>Lucena Youth Leadership Hub</strong>.
              Click the button below to verify your email address and activate your account.
            </p>
            <p style="text-align:center;margin:0 0 24px;">
              <a href="{verify_link}"
                 style="display:inline-block;background:#0038a8;color:#ffffff;
                        font-weight:700;font-size:15px;padding:14px 32px;
                        border-radius:10px;text-decoration:none;">
                Verify my email
              </a>
            </p>
            <p style="margin:0;color:#64748b;font-size:13px;">
              Or copy this link into your browser:<br>
              <a href="{verify_link}" style="color:#3b82f6;word-break:break-all;">{verify_link}</a>
            </p>
            <p style="margin:20px 0 0;color:#64748b;font-size:13px;">
              This link expires in <strong>24 hours</strong>.
              If you did not register, you can safely ignore this email.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
            <p style="margin:0;color:#94a3b8;font-size:12px;">
              You are receiving this because you created an account on the
              <strong>Lucena Youth Leadership Hub</strong>.<br>
              Questions? Contact us at
              <a href="mailto:lydo@lucena.gov.ph" style="color:#3b82f6;">lydo@lucena.gov.ph</a>.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""

    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', settings.EMAIL_HOST_USER)
    msg = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=from_email,
        to=[user.email],
    )
    msg.attach_alternative(html_body, "text/html")
    try:
        msg.send()
    except Exception as exc:
        logger.error("Failed to send verification email to %s: %s", user.email, exc)


# ---------------------------------------------------------------------------
# Auth views
# ---------------------------------------------------------------------------

class LoginView(TokenObtainPairView):
    def post(self, request, *args, **kwargs):
        # Check email verification BEFORE handing off to SimpleJWT.
        # Only block users who exist AND haven't verified yet.
        email = request.data.get("email", "")
        try:
            candidate = User.objects.get(email=email)
            if not candidate.is_email_verified:
                return Response(
                    {
                        "detail": "Please verify your email address before logging in. "
                                  "Check your inbox for the verification link.",
                        "code": "email_not_verified",
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )
        except User.DoesNotExist:
            pass  # Let SimpleJWT return the standard "no active account" error

        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            try:
                user = User.objects.select_related("profile").get(email=email)
                response.data["user"] = MeSerializer(
                    user, context={"request": request}
                ).data
            except User.DoesNotExist:
                pass
            AuditLog.objects.create(
                action="user_login",
                ip_address=get_client_ip(request),
                details={"email": email},
            )
        return response


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        email = request.data.get("email", "").strip().lower()

        # If the email already exists but is UNVERIFIED, resend the verification
        # email instead of returning a 400 "email already exists" error.
        try:
            existing = User.objects.get(email=email)
            if not existing.is_email_verified:
                EmailVerificationToken.objects.filter(user=existing).delete()
                token = EmailVerificationToken.objects.create(user=existing)
                _send_verification_email(existing, token)
                return Response(
                    {
                        "detail": "A new verification email has been sent. Please check your inbox.",
                        "email": existing.email,
                    },
                    status=status.HTTP_201_CREATED,
                )
            # Email exists AND is verified → let serializer produce the proper 400
        except User.DoesNotExist:
            pass

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()  # is_email_verified=False by default

        # Create a verification token and send email
        token = EmailVerificationToken.objects.create(user=user)
        _send_verification_email(user, token)

        return Response(
            {
                "detail": "Registration successful. Please check your email to verify your account.",
                "email": user.email,
            },
            status=status.HTTP_201_CREATED,
        )


class VerifyEmailView(generics.GenericAPIView):
    """GET /auth/verify-email/?token=<uuid>
    Verifies the token, marks the user as verified, returns JWT so they are
    immediately logged in on the frontend.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        token_str = request.query_params.get("token", "").strip()
        if not token_str:
            return Response({"detail": "Token is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            token_obj = EmailVerificationToken.objects.select_related("user").get(token=token_str)
        except (EmailVerificationToken.DoesNotExist, ValueError, DjangoValidationError):
            return Response(
                {"detail": "Invalid verification link.", "code": "invalid_token"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if token_obj.is_expired():
            token_obj.delete()
            return Response(
                {"detail": "This verification link has expired. Please request a new one.", "code": "token_expired"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = token_obj.user
        if not user.is_email_verified:
            user.is_email_verified = True
            user.save(update_fields=["is_email_verified"])

        # Delete the used token
        token_obj.delete()

        # Issue JWT so the frontend can log the user in immediately
        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "detail": "Email verified successfully!",
                "user": MeSerializer(user, context={"request": request}).data,
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            },
            status=status.HTTP_200_OK,
        )


class GoogleAuthView(generics.GenericAPIView):
    """POST /auth/google/
    Accepts { access_token } — the OAuth access token from the implicit flow.
    Calls Google's userinfo endpoint to verify and get the user's profile,
    then creates or retrieves the matching local user and returns a JWT pair.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        access_token = request.data.get("access_token", "")
        if not access_token:
            return Response({"detail": "Google access token is required."}, status=status.HTTP_400_BAD_REQUEST)

        # Call Google's userinfo endpoint to verify the token and get profile data
        import urllib.request
        import urllib.error
        import json as _json

        try:
            req = urllib.request.Request(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                id_info = _json.loads(resp.read().decode())
        except urllib.error.HTTPError as exc:
            logger.warning("Google userinfo request failed: %s", exc)
            return Response({"detail": "Invalid Google token. Please try again."}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            logger.error("Google userinfo request error: %s", exc)
            return Response({"detail": "Could not verify Google account. Please try again."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        email = id_info.get("email", "").lower()
        if not email:
            return Response({"detail": "Could not retrieve email from Google."}, status=status.HTTP_400_BAD_REQUEST)

        if not id_info.get("email_verified", False):
            return Response({"detail": "Google account email is not verified."}, status=status.HTTP_400_BAD_REQUEST)

        first_name = id_info.get("given_name", "").strip()
        last_name  = id_info.get("family_name", "").strip()

        # Get or create the user
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                "first_name": first_name or email.split("@")[0],
                "last_name":  last_name or "",
                "role":       User.Role.YOUTH,
                "youth_type": User.YouthType.GENERAL,
                "is_email_verified": True,
            },
        )

        if not created:
            # Existing user — ensure they are marked verified & active
            changed = []
            if not user.is_email_verified:
                user.is_email_verified = True
                changed.append("is_email_verified")
            if not user.is_active:
                return Response(
                    {"detail": "Your account has been deactivated. Contact LYDO for assistance."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            # Update name from Google if they had no name set
            if not user.first_name and first_name:
                user.first_name = first_name
                changed.append("first_name")
            if not user.last_name and last_name:
                user.last_name = last_name
                changed.append("last_name")
            if changed:
                user.save(update_fields=changed)
            # Also clean up any pending verification token
            EmailVerificationToken.objects.filter(user=user).delete()

        AuditLog.objects.create(
            action="google_login" if not created else "google_register",
            ip_address=get_client_ip(request),
            details={"email": email},
        )

        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "user": MeSerializer(user, context={"request": request}).data,
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "created": created,
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class ResendVerificationView(generics.GenericAPIView):
    """POST /auth/resend-verification/
    Accepts { email } and sends a fresh verification email if the user exists
    and has not yet verified.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get("email", "").strip().lower()
        if not email:
            return Response({"detail": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)

        # Always return 200 to avoid leaking whether the email exists
        try:
            user = User.objects.get(email=email)
            if not user.is_email_verified:
                # Delete any existing token and issue a fresh one
                EmailVerificationToken.objects.filter(user=user).delete()
                token = EmailVerificationToken.objects.create(user=user)
                _send_verification_email(user, token)
        except User.DoesNotExist:
            pass

        return Response(
            {"detail": "If that email is registered and unverified, a new link has been sent."},
            status=status.HTTP_200_OK,
        )


# ---------------------------------------------------------------------------
# Password reset
# ---------------------------------------------------------------------------

def _send_password_reset_email(user, token):
    """Send a branded password-reset email."""
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
    reset_link = f"{frontend_url}/reset-password?token={token.token}"

    subject = "[LYDO] Reset your password"
    text_body = (
        f"Hi {user.first_name},\n\n"
        f"We received a request to reset your password on the Lucena Youth Leadership Hub.\n\n"
        f"Click the link below to choose a new password:\n\n"
        f"{reset_link}\n\n"
        f"This link expires in 1 hour.\n\n"
        f"If you did not request a password reset, you can safely ignore this email.\n\n"
        f"— LYDO Team"
    )
    html_body = f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="600" cellpadding="0" cellspacing="0"
             style="max-width:600px;background:#ffffff;border-radius:12px;
                    overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <tr>
          <td style="background:#0038a8;padding:24px 32px;">
            <p style="margin:0;color:#ffffff;font-size:13px;letter-spacing:.05em;
                      text-transform:uppercase;opacity:.8;">
              Lucena City Youth Development Office
            </p>
            <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;line-height:1.3;">
              Reset your password
            </h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;color:#334155;font-size:15px;line-height:1.7;">
            <p style="margin:0 0 16px;">Hi <strong>{user.first_name}</strong>,</p>
            <p style="margin:0 0 24px;">
              We received a request to reset your password on the
              <strong>Lucena Youth Leadership Hub</strong>.
              Click the button below to choose a new password.
            </p>
            <p style="text-align:center;margin:0 0 24px;">
              <a href="{reset_link}"
                 style="display:inline-block;background:#0038a8;color:#ffffff;
                        font-weight:700;font-size:15px;padding:14px 32px;
                        border-radius:10px;text-decoration:none;">
                Reset my password
              </a>
            </p>
            <p style="margin:0;color:#64748b;font-size:13px;">
              Or copy this link into your browser:<br>
              <a href="{reset_link}" style="color:#3b82f6;word-break:break-all;">{reset_link}</a>
            </p>
            <p style="margin:20px 0 0;color:#64748b;font-size:13px;">
              This link expires in <strong>1 hour</strong>.
              If you did not request a password reset, you can safely ignore this email.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
            <p style="margin:0;color:#94a3b8;font-size:12px;">
              You are receiving this because a password reset was requested for your account on the
              <strong>Lucena Youth Leadership Hub</strong>.<br>
              Questions? Contact us at
              <a href="mailto:lydo@lucena.gov.ph" style="color:#3b82f6;">lydo@lucena.gov.ph</a>.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""

    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', settings.EMAIL_HOST_USER)
    msg = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=from_email,
        to=[user.email],
    )
    msg.attach_alternative(html_body, "text/html")
    try:
        msg.send()
    except Exception as exc:
        logger.error("Failed to send password reset email to %s: %s", user.email, exc)


class ForgotPasswordView(generics.GenericAPIView):
    """POST /auth/forgot-password/
    Accepts { email }. Always returns 200 to avoid leaking whether the email exists.
    Sends a reset link if the account exists and is active.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get("email", "").strip().lower()
        if not email:
            return Response({"detail": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(email=email, is_active=True)
            PasswordResetToken.objects.filter(user=user).delete()
            token = PasswordResetToken.objects.create(user=user)
            _send_password_reset_email(user, token)
        except User.DoesNotExist:
            pass

        return Response(
            {"detail": "If that email is registered, a password reset link has been sent."},
            status=status.HTTP_200_OK,
        )


class ResetPasswordView(generics.GenericAPIView):
    """POST /auth/reset-password/
    Accepts { token, password, password2 }. Validates token, sets new password.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        token_str = str(request.data.get("token", "")).strip()
        password = request.data.get("password", "")
        password2 = request.data.get("password2", "")

        if not token_str:
            return Response({"detail": "Token is required."}, status=status.HTTP_400_BAD_REQUEST)
        if not password or not password2:
            return Response({"detail": "Password is required."}, status=status.HTTP_400_BAD_REQUEST)
        if password != password2:
            return Response({"detail": "Passwords do not match."}, status=status.HTTP_400_BAD_REQUEST)
        if len(password) < 8:
            return Response({"detail": "Password must be at least 8 characters."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            token_obj = PasswordResetToken.objects.select_related("user").get(token=token_str)
        except (PasswordResetToken.DoesNotExist, ValueError, DjangoValidationError):
            return Response(
                {"detail": "Invalid or expired reset link.", "code": "invalid_token"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if token_obj.is_expired():
            token_obj.delete()
            return Response(
                {"detail": "This reset link has expired. Please request a new one.", "code": "token_expired"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = token_obj.user
        user.set_password(password)
        user.save(update_fields=["password"])
        token_obj.delete()

        AuditLog.objects.create(
            action="password_reset",
            ip_address=get_client_ip(request),
            details={"email": user.email},
        )

        return Response({"detail": "Password reset successful. You can now log in."}, status=status.HTTP_200_OK)


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = MeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

    def update(self, request, *args, **kwargs):
        if "avatar" in request.FILES:
            user = request.user
            user.avatar = request.FILES["avatar"]
            user.save(update_fields=["avatar"])
        return super().update(request, *args, **kwargs)


class ProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = ProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        profile, _ = Profile.objects.get_or_create(user=self.request.user)
        return profile

    def perform_update(self, serializer):
        serializer.save()


class SkillViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Skill.objects.all().order_by("name")
    serializer_class = SkillSerializer
    permission_classes = [permissions.IsAuthenticated]
    search_fields = ["name"]


class InterestViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Interest.objects.all().order_by("name")
    serializer_class = InterestSerializer
    permission_classes = [permissions.IsAuthenticated]
    search_fields = ["name"]


class UserSkillView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        names = request.data.get("skills", [])
        if not isinstance(names, list) or len(names) > 20:
            return Response({"detail": "Invalid skills list."}, status=400)
        user = request.user
        user.user_skills.all().delete()
        for name in names[:20]:
            skill, _ = Skill.objects.get_or_create(name=name[:100].strip())
            UserSkill.objects.get_or_create(user=user, skill=skill)
        return Response({"skills": names})


class UserInterestView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        names = request.data.get("interests", [])
        if not isinstance(names, list) or len(names) > 20:
            return Response({"detail": "Invalid interests list."}, status=400)
        user = request.user
        user.user_interests.all().delete()
        for name in names[:20]:
            interest, _ = Interest.objects.get_or_create(name=name[:100].strip())
            UserInterest.objects.get_or_create(user=user, interest=interest)
        return Response({"interests": names})


class DocumentViewSet(viewsets.ModelViewSet):
    serializer_class = DocumentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Document.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class ChangePasswordView(generics.GenericAPIView):
    serializer_class = ChangePasswordSerializer
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = request.user
        if not user.check_password(serializer.validated_data["old_password"]):
            return Response({"old_password": "Incorrect password."}, status=400)
        user.set_password(serializer.validated_data["new_password"])
        user.save()
        return Response({"detail": "Password changed successfully."})


class CompleteOnboardingView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        user.onboarding_complete = True
        user.save(update_fields=["onboarding_complete"])
        return Response({"detail": "Onboarding complete."})


class UserAdminViewSet(viewsets.ModelViewSet):
    queryset = User.objects.select_related("profile").all()
    serializer_class = UserAdminSerializer
    permission_classes = [IsAdminRole]
    search_fields = ["email", "first_name", "last_name"]
    filterset_fields = ["role", "is_active"]
    ordering_fields = ["date_joined", "first_name"]

    def perform_create(self, serializer):
        # Admin-created users are auto-verified (admin vouches for the email)
        serializer.save(is_email_verified=True)

    @action(detail=False, methods=["get"], url_path="youth-type-counts")
    def youth_type_counts(self, request):
        from django.db.models import Count
        data = (
            User.objects.filter(role="youth", is_active=True)
            .values("youth_type")
            .annotate(count=Count("id"))
        )
        return Response({item["youth_type"]: item["count"] for item in data})

    @action(detail=True, methods=["post"])
    def deactivate(self, request, pk=None):
        user = self.get_object()
        user.is_active = False
        user.save(update_fields=["is_active"])
        AuditLog.objects.create(
            user=request.user,
            action="user_deactivated",
            ip_address=get_client_ip(request),
            details={"target_email": user.email},
        )
        return Response({"detail": "User deactivated."})

    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        user = self.get_object()
        user.is_active = True
        user.save(update_fields=["is_active"])
        AuditLog.objects.create(
            user=request.user,
            action="user_activated",
            ip_address=get_client_ip(request),
            details={"target_email": user.email},
        )
        return Response({"detail": "User activated."})

    @action(detail=True, methods=["post"])
    def change_role(self, request, pk=None):
        if request.user.role != User.Role.SUPER_ADMIN:
            return Response({"detail": "Only Super Admins can change roles."}, status=403)
        user = self.get_object()
        new_role = request.data.get("role")
        if new_role not in User.Role.values:
            return Response({"detail": "Invalid role."}, status=400)
        old_role = user.role
        user.role = new_role
        user.save(update_fields=["role"])
        AuditLog.objects.create(
            user=request.user,
            action="role_changed",
            ip_address=get_client_ip(request),
            details={"target_email": user.email, "from": old_role, "to": new_role},
        )
        return Response({"detail": f"Role changed to {new_role}."})


# ── Personal Calendar ──────────────────────────────────────────────────────────

from .models import PersonalEvent
from .serializers import PersonalEventSerializer

class PersonalEventViewSet(viewsets.ModelViewSet):
    """
    CRUD for the authenticated user's personal calendar events.
    GET    /auth/personal-events/          → list own events
    POST   /auth/personal-events/          → create event
    PATCH  /auth/personal-events/{id}/     → update event
    DELETE /auth/personal-events/{id}/     → delete event
    """
    serializer_class   = PersonalEventSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return PersonalEvent.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


# ── Audit Log ──────────────────────────────────────────────────────────────────

class AuditLogListView(generics.ListAPIView):
    """GET /auth/admin/audit-logs/
    Returns a paginated, filterable list of audit log entries.
    Admin-only.

    Query params:
      action   – partial-match filter on action field
      email    – filter by actor email (partial)
      date     – filter by date (YYYY-MM-DD)
    """
    serializer_class   = AuditLogSerializer
    permission_classes = [IsAdminRole]

    def get_queryset(self):
        qs = AuditLog.objects.select_related("user").order_by("-created_at")
        action = self.request.query_params.get("action", "").strip()
        email  = self.request.query_params.get("email",  "").strip()
        date   = self.request.query_params.get("date",   "").strip()
        if action:
            qs = qs.filter(action__icontains=action)
        if email:
            qs = qs.filter(user__email__icontains=email)
        if date:
            qs = qs.filter(created_at__date=date)
        return qs


# ── Public stats ───────────────────────────────────────────────────────────────

class StatsView(generics.GenericAPIView):
    """GET /auth/stats/ — public endpoint returning platform-wide counts."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        from apps.sk_requirements.models import SKBarangay
        from apps.youth_orgs.models import YouthOrganization
        from apps.jobs.models import JobOpportunity

        return Response({
            'registered_youth': User.objects.filter(role='youth', is_active=True).count(),
            'barangay_sk_councils': SKBarangay.objects.count(),
            'youth_organizations': YouthOrganization.objects.count(),
            'active_jobs': JobOpportunity.objects.filter(is_active=True).count(),
        })
