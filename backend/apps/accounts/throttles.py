from rest_framework.throttling import SimpleRateThrottle


class EmailRateThrottle(SimpleRateThrottle):
    """Rate-limit by the email in the request body.

    The API sits behind the Vercel proxy, so every visitor can share one IP address;
    limiting by IP would lock everybody out at once. Limiting by email stops password
    guessing and email-bombing of a single account without hurting anyone else.
    """

    def get_cache_key(self, request, view):
        email = str(request.data.get("email", "")).strip().lower() if hasattr(request, "data") else ""
        ident = email or self.get_ident(request)
        return self.cache_format % {"scope": self.scope, "ident": ident}


class LoginThrottle(EmailRateThrottle):
    scope = "auth_login"


class EmailSendThrottle(EmailRateThrottle):
    """Forgot-password and resend-verification (each one sends an email)."""
    scope = "auth_email"


class FriendlyThrottleMixin:
    """Show a readable message instead of DRF's default text."""

    def throttled(self, request, wait):
        from rest_framework.exceptions import Throttled

        raise Throttled(wait=wait, detail="Too many attempts. Please try again shortly.")
