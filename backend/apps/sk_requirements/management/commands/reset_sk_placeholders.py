"""Pre-launch cleanup: put demo SK requirement rows back to a clean "Not Yet Submitted" state. Rows and files are NEVER deleted.

Placeholder rows are those that look submitted or late but have no uploaded file, were never reviewed by LYDO, and have no compliance record:
  * "submitted" with no file (demo "submitted" statuses and their made-up dates)
  * "overdue" status or a due date that nobody configured (demo deadlines). Official deadlines now live in Admin > SK Compliance > Deadlines.
Real uploads, anything LYDO reviewed, and anything in the compliance records are left exactly as they are.

    python manage.py reset_sk_placeholders          # only lists what it would change
    python manage.py reset_sk_placeholders --yes    # really changes it
"""
from django.core.management.base import BaseCommand
from django.db.models import Q

from apps.sk_requirements.models import SKRequirement


class Command(BaseCommand):
    help = 'Reset demo requirement rows (fake submitted / overdue / due dates) to Not Yet Submitted. Dry run unless --yes.'

    def add_arguments(self, parser):
        parser.add_argument('--yes', action='store_true', help='Really change them.')

    def handle(self, *args, yes=False, **opts):
        no_real_data = Q(reviewed_at__isnull=True, compliance_records__isnull=True) & (Q(file='') | Q(file__isnull=True))
        demo = Q(status__in=['submitted', 'overdue']) | Q(due_date__isnull=False) | Q(submitted_at__isnull=False)
        rows = list(SKRequirement.objects.filter(no_real_data).filter(demo).exclude(status='draft').distinct().select_related('barangay'))
        for r in rows[:15]:
            self.stdout.write(f'  {r.barangay.barangay_name}: {r.get_requirement_type_display()} (status {r.status}, due {r.due_date or "-"})')
        if len(rows) > 15:
            self.stdout.write(f'  ... and {len(rows) - 15} more')
        self.stdout.write(f'{len(rows)} placeholder row(s) found.')
        if not yes:
            self.stdout.write('Nothing changed. Run again with --yes to reset them.')
            return
        for r in rows:
            r.status, r.submitted_at, r.due_date = 'pending', None, None
            r.save(update_fields=['status', 'submitted_at', 'due_date', 'updated_at'])
        self.stdout.write(self.style.SUCCESS(f'Reset {len(rows)} row(s) to "Not Yet Submitted". No rows or files were deleted.'))
