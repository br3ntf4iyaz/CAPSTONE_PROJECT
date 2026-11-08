from rest_framework.throttling import SimpleRateThrottle


class _ChatThrottle(SimpleRateThrottle):
    """Counts only messages sent to the AI (POST), per logged-in user or per IP."""

    def get_cache_key(self, request, view):
        if request.method != 'POST':
            return None  # reading history is free
        ident = request.user.pk if request.user and request.user.is_authenticated else self.get_ident(request)
        return self.cache_format % {'scope': self.scope, 'ident': ident}


class ChatBurstThrottle(_ChatThrottle):
    """Short-window limit so nobody can spam the AI."""

    scope = 'chatbot_burst'


class ChatDailyThrottle(_ChatThrottle):
    """Daily cap to protect the Groq quota."""

    scope = 'chatbot_daily'
