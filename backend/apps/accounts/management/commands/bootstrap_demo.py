import os

from django.contrib.auth import get_user_model
from django.core.management import BaseCommand, call_command


class Command(BaseCommand):
    help = (
        "First-deploy setup: loads the demo data once (skipped if users already exist), "
        "then replaces the seed passwords with DEMO_PASSWORD so public demo accounts are not guessable."
    )

    def handle(self, *args, **options):
        User = get_user_model()
        if User.objects.exists():
            self.stdout.write('Users already exist - skipping demo bootstrap.')
            return

        password = os.getenv('DEMO_PASSWORD')
        if not password:
            self.stdout.write(self.style.WARNING('DEMO_PASSWORD is not set - skipping demo bootstrap.'))
            return

        call_command('seed_data')
        for user in User.objects.all():
            user.set_password(password)
            user.save(update_fields=['password'])
        call_command('anchor_ledger', '--backfill')
        self.stdout.write(self.style.SUCCESS('Demo data loaded. All seeded accounts use DEMO_PASSWORD.'))
