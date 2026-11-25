"""Find SK requirement rows that were only DEMO data and put them back to "not submitted" (rows and files are never deleted).

A row counts as a placeholder when it says "submitted" but there is no uploaded file, LYDO never reviewed it, and the compliance
system holds no record for it. Real submissions (with a file), anything LYDO reviewed, and anything in the compliance records are left alone.

    python manage.py reset_sk_placeholders          # only lists what it would change
    python manage.py reset_sk_placeholders --yes    # really changes it
"""
from django.core.management.base import BaseCommand
from django.db.models import Q
from django.utils import timezone

from apps.sk_requirements.models import SKRequirement


class Command(BaseCommand):
    help = 'Reset demo "submitted" requirement rows that have no file and no review (dry run unless --yes).'

    def add_arguments(self, parser):
        parser.add_argument('--yes', action='store_true', help='Really change them.')

    def handle(self, *args, yes=False, **opts):
        today = timezone.localdate()
        qs = SKRequirement.objects.filter(status='submitted', reviewed_at__isnull=True, compliance_records__isnull=True).filter(Q(file='') | Q(file__isnull=True)).distinct()
        rows = list(qs.select_related('barangay'))
        for r in rows[:15]:
            self.stdout.write(f'  {r.barangay.barangay_name}: {r.get_requirement_type_display()}')
        if len(rows) > 15:
            self.stdout.write(f'  ... and {len(rows) - 15} more')
        self.stdout.write(f'{len(rows)} placeholder row(s) found.')
        if not yes:
            self.stdout.write('Nothing changed. Run again with --yes to reset them.')
            return
        for r in rows:
            r.status = 'overdue' if r.due_date and r.due_date < today else 'pending'
            r.submitted_at = None
            r.save(update_fields=['status', 'submitted_at', 'updated_at'])
        self.stdout.write(self.style.SUCCESS(f'Reset {len(rows)} row(s) to "not submitted". No rows or files were deleted.'))
