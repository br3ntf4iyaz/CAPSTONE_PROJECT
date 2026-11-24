"""Which course audiences an account may see and enroll in.

  * General Youth account      -> General Youth courses
  * SK official account        -> SK Officials courses + General Youth courses
  * Youth Org Leader account   -> Youth Organization Leaders courses + General Youth courses

General Youth courses are the shared foundation for everyone. Staff and admin roles are not restricted. Enrollments that
already exist are never removed, so nobody loses progress or a certificate when these rules change.
"""
from django.db.models import Exists, OuterRef, Q

GENERAL = 'general_youth'
ORG = 'youth_org_leaders'
SK = 'sk_officials'
ALL_AUDIENCES = (GENERAL, ORG, SK)

_BY_YOUTH_TYPE = {
    'general_youth': (GENERAL,),
    'sk': (GENERAL, SK),
    'youth_org_leader': (GENERAL, ORG),
}


def allowed_audiences(user):
    """The audiences this user may use, in display order. Everyone who is not a youth account (staff, admins, visitors) gets all."""
    if not getattr(user, 'is_authenticated', False) or getattr(user, 'role', '') != 'youth':
        return ALL_AUDIENCES
    return _BY_YOUTH_TYPE.get(getattr(user, 'youth_type', '') or 'general_youth', (GENERAL,))


def restrict_courses(qs, user):
    """Limit a Course queryset to what the user may see: allowed audiences, plus any course they are already enrolled in."""
    allowed = allowed_audiences(user)
    if len(allowed) == len(ALL_AUDIENCES):
        return qs
    from .models import Enrollment
    mine = Enrollment.objects.filter(user=user, course=OuterRef('pk'))
    return qs.filter(Q(audience__in=allowed) | Exists(mine))


def may_enroll(user, course):
    return course.audience in allowed_audiences(user)
