from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.verification.models import IDVerification


class Command(BaseCommand):
    help = (
        'Retention policy: delete the stored ID photos and selfies of decided verifications '
        '(approved or rejected) older than N days. The decision itself is kept. '
        'Dry run by default: pass --apply.'
    )

    def add_arguments(self, parser):
        parser.add_argument('--days', type=int, default=180, help='Keep photos this long after the decision (default 180).')
        parser.add_argument('--apply', action='store_true')

    def handle(self, *args, **opts):
        cutoff = timezone.now() - timedelta(days=opts['days'])
        qs = IDVerification.objects.filter(
            status__in=[IDVerification.Status.APPROVED, IDVerification.Status.REJECTED],
        ).filter(reviewed_at__lt=cutoff) | IDVerification.objects.filter(
            status__in=[IDVerification.Status.APPROVED, IDVerification.Status.REJECTED],
            reviewed_at__isnull=True, updated_at__lt=cutoff,
        )
        files = 0
        records = 0
        for v in qs.distinct():
            names = [f for f in (v.id_image, v.id_back_image, v.selfie_image) if f]
            if not names:
                continue
            records += 1
            files += len(names)
            self.stdout.write(f'  #{v.pk} {v.user.email}: {len(names)} photo(s)')
            if opts['apply']:
                for f in names:
                    f.delete(save=False)
                v.id_image = v.id_back_image = v.selfie_image = None
                v.save(update_fields=['id_image', 'id_back_image', 'selfie_image'])
        verb = 'Deleted' if opts['apply'] else 'Would delete'
        self.stdout.write(self.style.SUCCESS(f'\n{verb} {files} photo(s) from {records} verification(s) older than {opts["days"]} days.'))
        if not opts['apply']:
            self.stdout.write(self.style.WARNING('Dry run only. Re-run with --apply.'))
