"""Put the real chairperson portraits that LYDO supplied into the SK Directory.

The pictures live in apps/sk_requirements/seed_assets/. A chairperson who ALREADY has a picture (uploaded by the SK or by LYDO)
is never overwritten, unless --force is given. Cartoon placeholders (file name starting with sample_) are replaced.
"""
import os

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand

from apps.sk_requirements.models import SKBarangay

ASSETS = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'seed_assets')

# barangay name -> file in seed_assets
PHOTOS = {
    'Ilayang Talim': 'ilayang_talim_chairperson.jpg',
}


class Command(BaseCommand):
    help = 'Set the real chairperson photos that were supplied with the project.'

    def add_arguments(self, parser):
        parser.add_argument('--force', action='store_true', help='Replace a picture that is already there.')

    def handle(self, *args, force=False, **opts):
        done = skipped = missing = 0
        for name, filename in PHOTOS.items():
            b = SKBarangay.objects.filter(barangay_name__iexact=name).first()
            if b is None:
                self.stdout.write(self.style.WARNING(f'No barangay called "{name}".'))
                missing += 1
                continue
            current = os.path.basename(b.chairperson_photo.name) if b.chairperson_photo else ''
            # a cartoon placeholder (sample_...) is replaced; a real upload never is
            if current and not current.startswith('sample_') and not force:
                skipped += 1
                continue
            if b.chairperson_photo:
                b.chairperson_photo.delete(save=False)
            with open(os.path.join(ASSETS, filename), 'rb') as f:
                b.chairperson_photo.save(f'chair_{b.pk}.jpg', ContentFile(f.read()), save=True)
            done += 1
        self.stdout.write(self.style.SUCCESS(f'Set {done} chairperson photo(s); kept {skipped} that already had one; {missing} barangay not found.'))
