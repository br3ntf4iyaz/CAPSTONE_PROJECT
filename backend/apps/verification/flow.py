"""Account verification states and what the person is told. One place, so the screens and the notices agree."""
from .models import IDVerification, VerificationEvent

S = IDVerification.Status

# what the person reads on each outcome: (notification title, message)
def _note(note):
    return f" Reason: {note}" if note else ""


def message_for(action, note=""):
    return {
        "approved": ("Identity verified", "Your account is verified. You can now apply for jobs, scholarships, programs and youth organizations."),
        "rejected": ("Verification rejected", "Your account verification was rejected." + _note(note) + " You may submit again with clear documents."),
        "revision": ("Revision required", "Your verification needs a correction." + _note(note) + " Open Verify Identity to fix it and submit again."),
        "suspended": ("Account suspended", "Your verified status was suspended." + _note(note) + " You cannot apply for anything until it is restored. Please contact LYDO."),
        "restored": ("Account verification restored", "Your verified status was restored. You can apply again."),
        "revoked": ("Verification revoked", "Your verified status was taken back." + _note(note) + " You may submit your documents again."),
        "submitted": ("Verification under review", "Your documents need a quick check by the LYDO team. We will notify you of the result."),
        "resubmitted": ("Verification resubmitted", "Thank you. Your corrected documents were sent to the LYDO team for review."),
    }[action]


def record(v, action, actor=None, from_status="", note=""):
    return VerificationEvent.objects.create(
        verification=v, actor=actor, action=action, from_status=from_status, to_status=v.status, note=(note or "")[:1000],
    )


def notify(v, action, note=""):
    """Tell the person. Never blocks the change that was made."""
    try:
        from apps.notifications.models import Notification
        title, text = message_for(action, note)
        Notification.objects.create(user=v.user, title=title, message=text, notification_type="system", link="/verify-identity")
    except Exception:
        pass


def notify_admins_resubmitted(v):
    try:
        from django.contrib.auth import get_user_model
        from apps.notifications.models import Notification
        who = v.user.full_name or v.user.email
        for admin in get_user_model().objects.filter(role__in=["lgu_admin", "super_admin"], is_active=True):
            Notification.objects.create(user=admin, title="Verification resubmitted", message=f"{who} sent a corrected verification ({v.reference_number}).",
                                        notification_type="system", link="/admin/verification")
    except Exception:
        pass


def applicant_info(user):
    """What the reviewer needs to compare against the documents. Shown to LYDO admins only."""
    from datetime import date
    p = getattr(user, "profile", None)
    born = getattr(p, "birthdate", None)
    age = None
    if born:
        today = date.today()
        age = today.year - born.year - ((today.month, today.day) < (born.month, born.day))
    return {
        "name": user.full_name or user.email, "email": user.email, "youth_type": getattr(user, "youth_type", "") or "",
        "birthdate": born, "age": age, "sex": getattr(p, "gender", ""),
        "phone": getattr(p, "phone", ""), "barangay": getattr(p, "barangay", ""),
        "municipality": getattr(p, "municipality", ""), "province": getattr(p, "province", ""),
        "is_minor": age is not None and age < 18,
    }
