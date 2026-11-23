from rest_framework.throttling import SimpleRateThrottle


class VerificationSubmitThrottle(SimpleRateThrottle):
    """Each person may submit a verification only a handful of times per day."""

    scope = "verification_submit"

    def get_cache_key(self, request, view):
        user = getattr(request, "user", None)
        ident = user.pk if user is not None and user.is_authenticated else self.get_ident(request)
        return self.cache_format % {"scope": self.scope, "ident": ident}
