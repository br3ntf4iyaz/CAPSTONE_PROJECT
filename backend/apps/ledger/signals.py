import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

from . import payloads
from .service import record

log = logging.getLogger(__name__)


def _safely(kind, ref, build):
    """Anchoring must never break the request that triggered it."""
    try:
        record(kind, ref, build())
    except Exception:
        log.exception('Could not anchor %s:%s', kind, ref)


@receiver(post_save, sender='programs.SubmissionReviewLog')
def anchor_review_log(sender, instance, created, raw=False, **kwargs):
    if created and not raw:
        _safely(payloads.REVIEW_LOG, instance.pk, lambda: payloads.review_log(instance))


@receiver(post_save, sender='programs.SubmissionReviewLog')
def anchor_ppa_submission(sender, instance, created, raw=False, **kwargs):
    # Fingerprint the proposal as it stood when it was (re)submitted for review.
    if created and not raw and instance.action == 'submitted':
        sub = instance.submission
        _safely(payloads.PPA_SUBMISSION, sub.pk, lambda: payloads.ppa_submission(sub))


@receiver(post_save, sender='youth_orgs.YouthOrganization')
def anchor_yorp_decision(sender, instance, raw=False, **kwargs):
    if not raw and instance.status in payloads.YORP_FINAL:
        _safely(payloads.YORP_DECISION, instance.pk, lambda: payloads.yorp_decision(instance))


@receiver(post_save, sender='sk_requirements.SKRequirement')
def anchor_sk_requirement(sender, instance, raw=False, **kwargs):
    if not raw and instance.status == 'submitted':
        _safely(payloads.SK_REQUIREMENT, instance.pk, lambda: payloads.sk_requirement(instance))


@receiver(post_save, sender='courses.Certificate')
def anchor_course_cert(sender, instance, raw=False, **kwargs):
    if not raw:
        _safely(payloads.COURSE_CERT, instance.pk, lambda: payloads.course_cert(instance))


@receiver(post_save, sender='recognition.Certificate')
def anchor_recognition_cert(sender, instance, raw=False, **kwargs):
    if not raw:
        _safely(payloads.RECOGNITION_CERT, instance.pk, lambda: payloads.recognition_cert(instance))


@receiver(post_save, sender='verification.IDVerification')
def anchor_id_decision(sender, instance, raw=False, **kwargs):
    if not raw and instance.status in payloads.ID_FINAL:
        _safely(payloads.ID_DECISION, instance.pk, lambda: payloads.id_decision(instance))
