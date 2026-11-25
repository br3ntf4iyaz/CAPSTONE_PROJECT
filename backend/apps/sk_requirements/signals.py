"""When the person in a seat changes, the previous official's public links must not pass to the replacement."""
from django.db.models.signals import pre_save
from django.dispatch import receiver

from .models import SKBarangay, SKMember, SKOfficialSocial


def _same_person(a, b):
    return ' '.join((a or '').lower().split()) == ' '.join((b or '').lower().split())


@receiver(pre_save, sender=SKMember)
def member_replaced(sender, instance, **kwargs):
    if not instance.pk:
        return
    old = SKMember.objects.filter(pk=instance.pk).values_list('name', flat=True).first()
    if old is not None and not _same_person(old, instance.name):
        SKOfficialSocial.objects.filter(member_id=instance.pk).delete()


@receiver(pre_save, sender=SKBarangay)
def chairperson_replaced(sender, instance, **kwargs):
    if not instance.pk:
        return
    old = SKBarangay.objects.filter(pk=instance.pk).values_list('sk_chairperson', flat=True).first()
    if old is not None and not _same_person(old, instance.sk_chairperson):
        SKOfficialSocial.objects.filter(barangay_id=instance.pk, is_chairperson=True).delete()
