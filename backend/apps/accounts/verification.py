"""Who may APPLY for jobs, scholarships and other opportunities: only people whose identity LYDO has verified.

Browsing is open to everyone, and so are the courses of the schools for anyone who is signed in. Only the act of applying needs a
verified identity, so that applications come from real, confirmed people. Staff accounts are not asked to verify.
"""
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission


def id_status(user):
    """'none' (never started), 'pending', 'reviewing', 'approved' or 'rejected'."""
    try:
        return user.id_verification.status or 'none'
    except Exception:
        return 'none'


def is_id_verified(user):
    if not getattr(user, 'is_authenticated', False):
        return False
    if getattr(user, 'role', 'youth') != 'youth':
        return True  # LGU and super admins do not apply, and are not blocked
    return id_status(user) == 'approved'


_MESSAGES = {
    'pending': 'Your identity verification is still waiting for review. You can apply as soon as it is approved.',
    'reviewing': 'Your identity verification is being reviewed. You can apply as soon as it is approved.',
    'rejected': 'Your identity verification was not approved. Please verify again to be able to apply.',
}


class IsIDVerified(BasePermission):
    """Applying needs an approved identity verification. The 403 carries code 'verify_first' so the app can guide the person."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False  # the authentication check answers this one with 401
        if is_id_verified(request.user):
            return True
        status = id_status(request.user)
        raise PermissionDenied({
            'detail': _MESSAGES.get(status, 'Please verify your identity first (Verify ID) before you apply. It only takes a few minutes.'),
            'code': 'verify_first',
            'verification_status': status,
        })
