"""
Deadline reminders for the SK Compliance Monitoring System. Run it once a day (a scheduled task).

    python manage.py send_compliance_reminders

SK officials of a barangay are told about: documents due within 7 days, documents returned for correction, and overdue documents.
LYDO administrators get one daily summary: documents waiting for verification and barangays with overdue documents.
It uses the existing notification system, and the same text is not sent to the same person again within the repeat window
(7 days for SK reminders, 1 day for the LYDO summary), so running it often does not spam anyone.
"""
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.compliance import sk_compliance as sk
from apps.compliance.models import SKComplianceRecord
from apps.sk_requirements.models import SKBarangay


class Command(BaseCommand):
    help = 'Send deadline reminders for SK compliance documents (no duplicates).'

    def handle(self, *args, **opts):
        today = timezone.localdate()
        years = {today.year} | ({today.year - 1} if today.month == 1 else set())
        sk.ensure_indexed()
        sent_sk = 0
        overdue_by_barangay = {}
        for b in SKBarangay.objects.filter(is_active=True).order_by('barangay_name'):
            due_soon, overdue, returned = [], [], []
            for year in sorted(years):
                for cat in sk.CATEGORIES:
                    for s in sk.slot_details(b, cat['key'], year, today):
                        if s['status'] == 'overdue':
                            overdue.append(f"{cat['short']} {s['label']}")
                        elif s['status'] == 'returned':
                            returned.append(f"{cat['short']} {s['label']}")
                        elif s['status'] == 'not_submitted' and s['deadline'] and 0 <= (s['deadline'] - today).days <= 7 and s['start'] <= today:
                            due_soon.append((f"{cat['short']} {s['label']}", (s['deadline'] - today).days))
            if overdue:
                overdue_by_barangay[b.barangay_name] = len(overdue)
            users = list(sk.sk_users_of(b))
            if not users:
                continue
            if due_soon:
                text = '; '.join(f'{label} (in {d} day{"s" if d != 1 else ""})' for label, d in due_soon[:6])
                sent_sk += sk.notify(users, 'SK compliance deadline coming up', f'Due soon: {text}.', '/sk-compliance', within_days=7)
            if returned:
                sent_sk += sk.notify(users, 'SK compliance documents need correction',
                                     f'Returned for correction: {"; ".join(returned[:6])}.', '/sk-compliance', within_days=7)
            if overdue:
                more = f' and {len(overdue) - 6} more' if len(overdue) > 6 else ''
                sent_sk += sk.notify(users, 'SK compliance documents are overdue',
                                     f'Overdue: {"; ".join(overdue[:6])}{more}.', '/sk-compliance', within_days=7)

        waiting = SKComplianceRecord.objects.filter(status__in=('submitted', 'under_verification')).count()
        ready = SKComplianceRecord.objects.filter(status='verified').count()
        sent_admin = 0
        if waiting or ready or overdue_by_barangay:
            parts = []
            if waiting:
                parts.append(f'{waiting} document(s) waiting for verification')
            if ready:
                parts.append(f'{ready} verified document(s) ready for publication')
            if overdue_by_barangay:
                parts.append(f'{len(overdue_by_barangay)} barangay(s) with overdue documents')
            sent_admin = sk.notify(sk.admin_users(), 'SK compliance summary', '; '.join(parts) + '.', '/admin/sk-compliance', within_days=1)
        self.stdout.write(self.style.SUCCESS(f'Reminders sent: {sent_sk} to SK officials, {sent_admin} to LYDO administrators.'))
