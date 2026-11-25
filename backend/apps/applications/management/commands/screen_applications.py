"""Run the AI screening for job applications that were never screened or whose screening failed (safe to run often)."""
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db.models import Q
from django.utils import timezone

from apps.applications.ai_screening import MAX_ATTEMPTS, STALE_AFTER, run_screening
from apps.applications.models import OpportunityApplication


class Command(BaseCommand):
    help = 'Screen job applications that are waiting, stuck or failed (up to 3 tries each).'

    def handle(self, *args, **opts):
        stale = timezone.now() - timedelta(seconds=STALE_AFTER)
        qs = OpportunityApplication.objects.filter(kind='job', status__in=['submitted', 'under_review'], ai_attempts__lt=MAX_ATTEMPTS).filter(
            Q(ai_status='pending', submitted_at__lt=stale) | Q(ai_status='processing', ai_started_at__lt=stale) | Q(ai_status__in=['failed', 'unavailable']))
        n = 0
        for app in qs:
            run_screening(app.pk)
            n += 1
        self.stdout.write(f'Screened {n} application(s).')
