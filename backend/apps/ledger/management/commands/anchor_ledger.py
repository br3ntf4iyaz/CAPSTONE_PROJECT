from django.core.management.base import BaseCommand

from apps.ledger import payloads, service
from apps.ledger.models import Anchor


class Command(BaseCommand):
    help = (
        "Retry anchors that are pending or failed. With --backfill, also anchor records that "
        "existed before anchoring was added, and any finished audit-log days not yet anchored. "
        "Backfilled records are trusted as they are today."
    )

    def add_arguments(self, parser):
        parser.add_argument('--backfill', action='store_true')

    def handle(self, *args, **opts):
        if opts['backfill']:
            from apps.programs.models import ProgramSubmission, SubmissionReviewLog
            from apps.sk_requirements.models import SKRequirement
            from apps.verification.models import IDVerification
            n = 0
            for log in SubmissionReviewLog.objects.all():
                service.record(payloads.REVIEW_LOG, log.pk, payloads.review_log(log)); n += 1
            for r in SKRequirement.objects.filter(status='submitted'):
                service.record(payloads.SK_REQUIREMENT, r.pk, payloads.sk_requirement(r)); n += 1
            for v in IDVerification.objects.filter(status__in=payloads.ID_FINAL):
                service.record(payloads.ID_DECISION, v.pk, payloads.id_decision(v)); n += 1
            from apps.courses.models import Certificate as CourseCert
            from apps.recognition.models import Certificate as RecognitionCert
            for c in CourseCert.objects.select_related('enrollment'):
                service.record(payloads.COURSE_CERT, c.pk, payloads.course_cert(c)); n += 1
            for c in RecognitionCert.objects.all():
                service.record(payloads.RECOGNITION_CERT, c.pk, payloads.recognition_cert(c)); n += 1
            from apps.youth_orgs.models import YouthOrganization
            for o in YouthOrganization.objects.filter(status__in=payloads.YORP_FINAL):
                service.record(payloads.YORP_DECISION, o.pk, payloads.yorp_decision(o)); n += 1
            for sub in ProgramSubmission.objects.filter(status__in=payloads.PPA_LOCKED):
                service.record(payloads.PPA_SUBMISSION, sub.pk, payloads.ppa_submission(sub)); n += 1
            n += payloads.anchor_audit_days()
            self.stdout.write(f'Fingerprinted {n} records.')
        retried = service.retry_unanchored()
        total = Anchor.objects.count()
        done = Anchor.objects.filter(status='anchored').count()
        self.stdout.write(self.style.SUCCESS(f'Retried {retried}. {done}/{total} anchors on the ledger.'))
