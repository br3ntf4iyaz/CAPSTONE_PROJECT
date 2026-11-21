from rest_framework.throttling import SimpleRateThrottle


class CheckinThrottle(SimpleRateThrottle):
    """Limit check-in code guesses per user (the code is only 6 digits)."""

    scope = "event_checkin"

    def get_cache_key(self, request, view):
        user = getattr(request, "user", None)
        ident = user.pk if user is not None and user.is_authenticated else self.get_ident(request)
        return self.cache_format % {"scope": self.scope, "ident": ident}
