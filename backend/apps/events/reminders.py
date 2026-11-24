"""Reminders for everyone on the platform: a new event, an event that is near, and opportunities that are about to close.

Each notice is sent ONCE. The link carries a marker (for example /events?e=12&n=3d), and a notice whose marker already exists is
never sent again, so running this as often as you like cannot spam anyone.
"""
from datetime import datetime, timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.notifications.models import Notification

BATCH = 500


def recipients():
    User = get_user_model()
    return User.objects.filter(is_active=True, role='youth').values_list('pk', flat=True)


def notify_everyone(title, message, link, notif_type='event'):
    """Send one notice to every young user, unless this exact notice (by its link marker) was already sent. Returns the count."""
    if Notification.objects.filter(link=link).exists():
        return 0
    rows = [Notification(user_id=pk, title=title[:255], message=message, notification_type=notif_type, link=link) for pk in recipients()]
    for i in range(0, len(rows), BATCH):
        Notification.objects.bulk_create(rows[i:i + BATCH])
    return len(rows)


def _when(event):
    return timezone.localtime(event.start_datetime).strftime('%B %d, %Y at %I:%M %p').replace(' 0', ' ')


def _where(event):
    return f' at {event.location}' if event.location else ''


def notify_new_event(event):
    """A newly published event that has not started yet."""
    if not (event.is_published and event.is_active) or event.start_datetime <= timezone.now():
        return 0
    return notify_everyone(
        f'New event: {event.title}',
        f'{event.title} will be on {_when(event)}{_where(event)}. Open the calendar to see the details.',
        f'/events?e={event.pk}&n=new',
    )


def send_due_reminders(now=None):
    """Events starting in the next 3 days, and jobs and scholarships closing in the next 3 days. Returns a summary dict."""
    from apps.events.models import Event
    from apps.jobs.models import JobOpportunity as Job
    from apps.resources.models import Scholarship

    now = now or timezone.now()
    today = timezone.localtime(now).date()
    sent = {'events': 0, 'jobs': 0, 'scholarships': 0}

    for ev in Event.objects.filter(is_published=True, is_active=True, start_datetime__gt=now, start_datetime__lte=now + timedelta(days=3)):
        hours = (ev.start_datetime - now).total_seconds() / 3600
        if hours <= 24:
            sent['events'] += notify_everyone(
                f'Tomorrow: {ev.title}' if hours > 12 else f'Today: {ev.title}',
                f'{ev.title} starts on {_when(ev)}{_where(ev)}. Do not miss it.', f'/events?e={ev.pk}&n=1d')
        else:
            sent['events'] += notify_everyone(
                f'Coming up: {ev.title}', f'{ev.title} is on {_when(ev)}{_where(ev)}. Mark your calendar.', f'/events?e={ev.pk}&n=3d')

    for job in Job.objects.filter(is_active=True, application_deadline__gte=today, application_deadline__lte=today + timedelta(days=3)):
        sent['jobs'] += notify_everyone(
            f'Closing soon: {job.title}', f'Applications for {job.title} close on {job.application_deadline:%B %d, %Y}.',
            f'/jobs?j={job.pk}&n=closing', 'system')

    for sch in Scholarship.objects.filter(is_published=True):
        try:
            due = datetime.strptime((sch.deadline or '').strip()[:10], '%Y-%m-%d').date()
        except ValueError:
            continue  # "Rolling", "TBD" and the like have no date to remind about
        if today <= due <= today + timedelta(days=3):
            sent['scholarships'] += notify_everyone(
                f'Closing soon: {sch.title}', f'The deadline for {sch.title} is {due:%B %d, %Y}.',
                f'/scholarships?s={sch.pk}&n=closing', 'system')
    return sent
