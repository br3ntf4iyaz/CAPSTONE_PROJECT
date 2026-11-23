import io

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand

from apps.sk_requirements.avatars import make_avatar
from apps.sk_requirements.models import SKBarangay, SKMember

SAMPLE_PREFIX = 'sample_'


def is_sample(field_file) -> bool:
    return bool(field_file) and field_file.name.rsplit('/', 1)[-1].startswith(SAMPLE_PREFIX)


def _png(seed: int) -> bytes:
    buf = io.BytesIO()
    make_avatar(seed).save(buf, 'PNG', optimize=True)
    return buf.getvalue()


class Command(BaseCommand):
    help = (
        'Give every SK official (Chairperson, 7 Kagawads, Secretary, Treasurer of every barangay) a cartoon '
        'SAMPLE face so the directory looks complete. Real uploaded pictures are NEVER replaced. '
        'Use --refresh to redraw the samples, --clear to remove only the samples again.'
    )

    def add_arguments(self, parser):
        parser.add_argument('--refresh', action='store_true', help='Redraw existing sample pictures too.')
        parser.add_argument('--clear', action='store_true', help='Remove the sample pictures (real pictures stay).')

    def handle(self, *args, **opts):
        added = replaced = cleared = kept_real = 0

        for barangay in SKBarangay.objects.all():
            # Chairperson
            seat = barangay.chairperson_photo
            if opts['clear']:
                if is_sample(seat):
                    seat.delete(save=False)
                    barangay.chairperson_photo = None
                    barangay.save(update_fields=['chairperson_photo'])
                    cleared += 1
            elif not seat:
                barangay.chairperson_photo.save(f'{SAMPLE_PREFIX}chair_{barangay.id}.png', ContentFile(_png(barangay.id * 1000)), save=True)
                added += 1
            elif is_sample(seat) and opts['refresh']:
                barangay.chairperson_photo.delete(save=False)
                barangay.chairperson_photo.save(f'{SAMPLE_PREFIX}chair_{barangay.id}.png', ContentFile(_png(barangay.id * 1000)), save=True)
                replaced += 1
            else:
                kept_real += 1

            # the other nine
            for m in SKMember.objects.filter(barangay=barangay):
                if opts['clear']:
                    if is_sample(m.photo):
                        m.photo.delete(save=False)
                        m.photo = None
                        m.save(update_fields=['photo'])
                        cleared += 1
                    continue
                if not m.photo:
                    m.photo.save(f'{SAMPLE_PREFIX}{m.id}.png', ContentFile(_png(barangay.id * 1000 + m.id)), save=True)
                    added += 1
                elif is_sample(m.photo) and opts['refresh']:
                    m.photo.delete(save=False)
                    m.photo.save(f'{SAMPLE_PREFIX}{m.id}.png', ContentFile(_png(barangay.id * 1000 + m.id)), save=True)
                    replaced += 1
                else:
                    kept_real += 1

        if opts['clear']:
            self.stdout.write(self.style.SUCCESS(f'Removed {cleared} sample picture(s). Real pictures were not touched.'))
        else:
            self.stdout.write(self.style.SUCCESS(
                f'Added {added} sample face(s), redrew {replaced}, left {kept_real} existing picture(s) untouched.'
            ))
