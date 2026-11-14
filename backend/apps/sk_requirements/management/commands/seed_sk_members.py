"""Give every SK barangay a full council: 7 kagawad, 1 secretary, 1 treasurer.

Names are SAMPLE data for demo purposes; replace them with the real officials
through Django admin (SK Barangays -> SK members) or the SK Barangay inline.
Only creates members for barangays that have none yet.
"""
import random

from django.core.management.base import BaseCommand

from apps.sk_requirements.models import SKBarangay, SKMember

FIRST = ['Angelo', 'Bea', 'Carlo', 'Danica', 'Emman', 'Faith', 'Gabriel', 'Hannah', 'Ian', 'Jasmine',
         'Kyle', 'Lance', 'Mika', 'Nathan', 'Patricia', 'Rafael', 'Sofia', 'Third', 'Vince', 'Zeny']
LAST = ['Reyes', 'Cruz', 'Bautista', 'Ocampo', 'Garcia', 'Mendoza', 'Santos', 'Aquino', 'Dizon', 'Navarro',
        'Castillo', 'Ramos', 'Torres', 'Villanueva', 'Flores', 'Panganiban', 'Magsino', 'Alcantara']


class Command(BaseCommand):
    help = 'Seed sample SK council members for each barangay.'

    def handle(self, *args, **opts):
        rng = random.Random(42)
        made = 0
        for b in SKBarangay.objects.all():
            if b.members.exists():
                continue
            roles = [('kagawad', f'Kagawad {i}') for i in range(1, 8)] + [('secretary', 'Secretary'), ('treasurer', 'Treasurer')]
            for order, (pos, _) in enumerate(roles):
                SKMember.objects.create(
                    barangay=b, position=pos, order=order,
                    name=f'{rng.choice(FIRST)} {rng.choice(LAST)}',
                )
                made += 1
        self.stdout.write(self.style.SUCCESS(f'{made} members created'))
