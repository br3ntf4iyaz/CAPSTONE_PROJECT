from rest_framework.throttling import SimpleRateThrottle


class SKPhotoThrottle(SimpleRateThrottle):
    """Picture changes are limited per person so the directory cannot be spammed."""

    scope = "sk_photo"

    def get_cache_key(self, request, view):
        user = getattr(request, "user", None)
        ident = user.pk if user is not None and user.is_authenticated else self.get_ident(request)
        return self.cache_format % {"scope": self.scope, "ident": ident}
