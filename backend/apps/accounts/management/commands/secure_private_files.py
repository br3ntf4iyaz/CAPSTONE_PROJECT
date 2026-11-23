import shutil
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from apps.applications.models import OpportunityApplication
from apps.verification.models import IDVerification


class Command(BaseCommand):
    help = (
        'Move government-ID photos, selfies and application documents out of the PUBLIC media folder '
        'into the private folder (they are then only served to logged-in admins/owners). '
        'Dry run by default: pass --apply.'
    )

    def add_arguments(self, parser):
        parser.add_argument('--apply', action='store_true')

    def handle(self, *args, **opts):
        apply = opts['apply']
        public, private = Path(settings.MEDIA_ROOT), Path(settings.PRIVATE_MEDIA_ROOT)
        moved = missing = already = 0

        targets = []
        for v in IDVerification.objects.all():
            targets += [f for f in (v.id_image, v.id_back_image, v.selfie_image) if f]
        for a in OpportunityApplication.objects.exclude(document=''):
            if a.document:
                targets.append(a.document)

        for f in targets:
            rel = f.name
            src, dst = public / rel, private / rel
            if dst.exists():
                already += 1
                if apply and src.exists():
                    src.unlink()  # a public copy must not linger
                continue
            if not src.exists():
                missing += 1
                self.stdout.write(self.style.WARNING(f'  missing on disk: {rel}'))
                continue
            moved += 1
            self.stdout.write(f'  move {rel}')
            if apply:
                dst.parent.mkdir(parents=True, exist_ok=True)
                shutil.move(str(src), str(dst))

        # Old copies no longer linked to any record (e.g. replaced uploads) are just as sensitive.
        # Move them aside instead of deleting, so nothing is lost.
        orphans = 0
        for folder in ('verification', 'applications'):
            root = public / folder
            if not root.exists():
                continue
            for path in sorted(p for p in root.rglob('*') if p.is_file()):
                rel = path.relative_to(public)
                orphans += 1
                self.stdout.write(f'  orphan (not linked to any record): {rel}')
                if apply:
                    dst = private / '_orphaned' / rel
                    dst.parent.mkdir(parents=True, exist_ok=True)
                    shutil.move(str(path), str(dst))

        verb = 'Moved' if apply else 'Would move'
        self.stdout.write(self.style.SUCCESS(f'\n{verb} {moved} file(s); {already} already private; {missing} missing; {orphans} unlinked old file(s) set aside.'))
        if not apply:
            self.stdout.write(self.style.WARNING('Dry run only. Re-run with --apply.'))
        self.stdout.write(
            'Also check: no file is left in the public folders:\n'
            f'  {public / "verification"}  and  {public / "applications"}'
        )
