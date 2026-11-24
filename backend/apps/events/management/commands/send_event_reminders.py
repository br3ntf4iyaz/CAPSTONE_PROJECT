"""
Remind everyone about events that are near and opportunities that are closing. Run it every hour (a scheduled task):

    python manage.py send_event_reminders

Events starting within 3 days, jobs and scholarships closing within 3 days. A new published event is announced at once, when it is
saved. Every notice is sent only once, so running it often is safe.
"""
from django.core.management.base import BaseCommand

from apps.events.reminders import send_due_reminders


class Command(BaseCommand):
    help = 'Send event reminders and closing-soon notices to every young user (no duplicates).'

    def handle(self, *args, **opts):
        s = send_due_reminders()
        self.stdout.write(f"Sent {s['events']} event, {s['jobs']} job and {s['scholarships']} scholarship notices.")
