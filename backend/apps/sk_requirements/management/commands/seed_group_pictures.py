"""Give every barangay a cartoon council group picture (drawn by code, built from the council portraits).

A REAL picture uploaded by an SK or by LYDO is never replaced. Only a missing picture, or an earlier cartoon placeholder
(file name starting with `sample_group_`) when --refresh is given, is (re)drawn.
"""
import os

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand

from apps.sk_requirements.group_art import make_group_picture
from apps.sk_requirements.models import SKBarangay


class Command(BaseCommand):
    help = 'Draw cartoon council group pictures for barangays that have none.'

    def add_arguments(self, parser):
        parser.add_argument('--refresh', action='store_true', help='Redraw earlier cartoon placeholders (never real uploads).')

    def handle(self, *args, refresh=False, **opts):
        made = skipped = 0
        for b in SKBarangay.objects.prefetch_related('members'):
            current = os.path.basename(b.group_photo.name) if b.group_photo else ''
            if current and not (refresh and current.startswith('sample_group_')):
                skipped += 1
                continue
            if current:
                b.group_photo.delete(save=False)
            b.group_photo.save(f'sample_group_{b.pk}.png', ContentFile(make_group_picture(b)), save=True)
            made += 1
        self.stdout.write(self.style.SUCCESS(f'Drew {made} group picture(s); kept {skipped} that already had one.'))
