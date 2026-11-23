from django.core.management.base import BaseCommand

from apps.sk_requirements.models import SKBarangay, SKMember
from apps.sk_requirements.serializers import SEAT_LIMITS


class Command(BaseCommand):
    help = (
        'Make sure every barangay has its full SK council: 7 Kagawads, 1 Secretary and 1 Treasurer '
        '(the Chairperson is kept on the barangay). Missing seats are filled with clearly labelled placeholder '
        'names such as "SK Kagawad 3" for the LYDO admin to replace with the real, verified names and pictures. '
        'Existing officials are never changed. Safe to run again.'
    )

    LABELS = {'kagawad': 'SK Kagawad', 'secretary': 'SK Secretary', 'treasurer': 'SK Treasurer'}

    def handle(self, *args, **opts):
        created = 0
        for barangay in SKBarangay.objects.all():
            if not barangay.sk_chairperson:
                barangay.sk_chairperson = 'SK Chairperson'
                barangay.save(update_fields=['sk_chairperson'])
            for position, limit in SEAT_LIMITS.items():
                existing = list(SKMember.objects.filter(barangay=barangay, position=position))
                used_orders = {m.order for m in existing}
                for slot in range(1, limit + 1):
                    if len(existing) >= limit:
                        break
                    order = next((n for n in range(1, limit + 1) if n not in used_orders), slot)
                    label = self.LABELS[position] + (f' {order}' if limit > 1 else '')
                    member = SKMember.objects.create(barangay=barangay, position=position, name=label, order=order)
                    existing.append(member)
                    used_orders.add(order)
                    created += 1
        total = SKBarangay.objects.count()
        self.stdout.write(self.style.SUCCESS(f'Checked {total} barangays; added {created} missing seat(s).'))
