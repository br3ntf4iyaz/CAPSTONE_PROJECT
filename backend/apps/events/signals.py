from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Event


@receiver(post_save, sender=Event)
def announce_new_event(sender, instance, **kwargs):
    """Tell everyone when an event becomes public. A notice problem must never stop the event from being saved."""
    try:
        from .reminders import notify_new_event
        notify_new_event(instance)
    except Exception:
        pass
