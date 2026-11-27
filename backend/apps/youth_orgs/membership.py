"""Membership applications: who may apply, what each decision means, and what the person is told.

An application is APPROVED means the person is a member of that organization. REVOKED takes it back and the history stays.
Only people whose account is verified may apply (the same check every other application uses).
"""
from datetime import date

from django.utils import timezone

from .models import OrgMembershipEvent

# who is moved from where: new status -> statuses it may follow
ALLOWED_FROM = {
    'reviewing': {'pending'},
    'accepted': {'pending', 'reviewing'},
    'revision': {'pending', 'reviewing'},
    'declined': {'pending', 'reviewing', 'revision'},
    'revoked': {'accepted'},
}
NEEDS_NOTE = {'revision', 'declined', 'revoked'}
EVENT_NAME = {'reviewing': 'review_started', 'accepted': 'approved', 'revision': 'revision_requested', 'declined': 'rejected', 'revoked': 'revoked'}


def applicant_snapshot(user):
    """The details auto-filled from the verified account. Frozen on the application, so a later profile change does not rewrite history."""
    p = getattr(user, 'profile', None)
    born = getattr(p, 'birthdate', None)
    age = None
    if born:
        t = date.today()
        age = t.year - born.year - ((t.month, t.day) < (born.month, born.day))
    return {
        'name': user.full_name or user.email,
        'email': user.email,
        'age': age,
        'sex': getattr(p, 'gender', '') or '',
        'barangay': getattr(p, 'barangay', '') or '',
        'phone': getattr(p, 'phone', '') or '',
    }


def snapshot_from(user, data):
    """The account details, with whatever the person corrected on the form (contact number, barangay, school). Only this application changes."""
    import re
    from .serializers import sanitize
    snap = applicant_snapshot(user)
    snap.setdefault('school', '')
    phone = str(data.get('contact_phone', snap['phone']) or '').strip()
    if phone and not re.fullmatch(r'[0-9+()\-\s]{7,20}', phone):
        raise ValueError('Enter a valid contact number.')
    snap['phone'] = phone
    for key, limit in (('barangay', 100), ('school', 150)):
        if key in data:
            snap[key] = sanitize(str(data.get(key) or '').strip())[:limit]
    return snap


def record(app, action, actor=None, from_status='', note=''):
    return OrgMembershipEvent.objects.create(application=app, actor=actor, action=action, from_status=from_status, to_status=app.status, note=(note or '')[:500])


def can_decide(app, new_status):
    """(ok, problem) for moving this application to `new_status`."""
    if app.status not in ALLOWED_FROM.get(new_status, set()):
        return False, 'This application cannot be moved to that status from where it is now.'
    return True, ''


def decide(app, new_status, actor, note=''):
    """Apply a decision and remember it. The caller has already checked who may do it and that a note was given where one is needed."""
    old = app.status
    app.status = new_status
    app.decision_note = note if new_status in NEEDS_NOTE else (note or '')
    if new_status in ('accepted', 'declined', 'revoked'):
        app.decided_by, app.decided_at = actor, timezone.now()
    app.save()
    record(app, EVENT_NAME[new_status], actor, old, note)
    notify_applicant(app, new_status, note)
    return app


def notify_applicant(app, new_status, note=''):
    from apps.notifications.views import create_notification
    org = app.organization.name
    text = {
        'reviewing': ('Application under review', f'Your application to join "{org}" is now being reviewed.'),
        'accepted': ('Membership approved', f'Congratulations! You are now a member of "{org}".'),
        'revision': ('Application needs a correction', f'Your application to join "{org}" needs a correction.' + (f' {note}' if note else '') + ' Open it to fix and send it again.'),
        'declined': ('Membership not approved', f'Your application to join "{org}" was not approved.' + (f' Reason: {note}' if note else '')),
        'revoked': ('Membership revoked', f'Your membership in "{org}" was revoked.' + (f' Reason: {note}' if note else '')),
    }[new_status]
    try:
        create_notification(app.applicant, text[0], text[1], 'system', link='/organizations')
    except Exception:
        pass
