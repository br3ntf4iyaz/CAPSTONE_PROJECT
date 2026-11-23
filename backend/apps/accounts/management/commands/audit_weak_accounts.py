import os
import re
import secrets
import string
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

User = get_user_model()

# Passwords that are written in the public seed/demo files, plus very common ones.
KNOWN_PASSWORDS = [
    'SuperAdmin123!', 'LGUAdmin123!', 'Youth123!',
    'admin123', 'Admin123!', 'password', 'password123', '12345678', 'changeme',
]


def random_password(length=16):
    alphabet = string.ascii_letters + string.digits + '!@#$%*-_'
    while True:
        pw = ''.join(secrets.choice(alphabet) for _ in range(length))
        if (any(c.islower() for c in pw) and any(c.isupper() for c in pw)
                and any(c.isdigit() for c in pw) and any(c in '!@#$%*-_' for c in pw)):
            return pw


class Command(BaseCommand):
    help = (
        'Find accounts that still use a password written in the seed files (anyone can read them) '
        'and, with --fix, give each one a new random password. Dry run by default.'
    )

    def add_arguments(self, parser):
        parser.add_argument('--fix', action='store_true', help='Replace the weak passwords and print the new ones once.')

    def seed_emails(self):
        """Emails created by seed_data.py, so only those accounts are checked (hashing is slow)."""
        seed = Path(__file__).with_name('seed_data.py')
        emails = set(re.findall(r'email="([^"]+)"', seed.read_text(encoding='utf-8', errors='ignore')))
        return {e.lower() for e in emails}

    def handle(self, *args, **opts):
        known = list(KNOWN_PASSWORDS)
        demo = os.getenv('DEMO_PASSWORD')
        if demo:
            known.append(demo)

        seeded = self.seed_emails()
        candidates = [
            u for u in User.objects.all()
            if u.role in ('lgu_admin', 'super_admin') or u.email.lower() in seeded
        ]
        self.stdout.write(f'Checking {len(candidates)} accounts (all admins + seeded demo accounts)...\n')

        weak = []
        for user in candidates:
            if not user.has_usable_password():
                continue
            for pw in known:
                if user.check_password(pw):
                    weak.append(user)
                    break

        if not weak:
            self.stdout.write(self.style.SUCCESS('No account uses a known default password.'))
            return

        self.stdout.write(self.style.ERROR(f'{len(weak)} account(s) use a publicly known password:'))
        for u in weak:
            flag = ' (ADMIN)' if u.role in ('lgu_admin', 'super_admin') else ''
            self.stdout.write(f'  - {u.email}  role={u.role}  active={u.is_active}{flag}')

        if not opts['fix']:
            self.stdout.write(self.style.WARNING('\nDry run: nothing changed. Re-run with --fix to give them new random passwords.'))
            return

        self.stdout.write(self.style.MIGRATE_HEADING('\nNew passwords (shown once, save them now):'))
        for u in weak:
            new = random_password()
            u.set_password(new)
            u.save(update_fields=['password'])
            self.stdout.write(f'  {u.email}  ->  {new}')
        self.stdout.write(self.style.SUCCESS('\nDone. The old passwords no longer work.'))
