import os
import tempfile
from datetime import timedelta
from types import SimpleNamespace
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import AuditLog
from apps.courses.models import Certificate as CourseCertificate, Course, Enrollment
from apps.programs.models import ProgramSubmission, SubmissionReviewLog
from apps.recognition.models import Certificate as RecognitionCertificate
from apps.sk_requirements.models import SKBarangay, SKRequirement
from apps.verification.models import IDVerification
from apps.youth_orgs.models import YouthOrganization

from . import payloads, service
from .models import Anchor, LedgerEntry

User = get_user_model()
MEDIA = tempfile.mkdtemp()


@override_settings(MEDIA_ROOT=MEDIA)
class Base(TestCase):
    def setUp(self):
        self.youth = User.objects.create_user(email='y@x.com', password='p', first_name='Juan', last_name='Cruz')
        self.other = User.objects.create_user(email='o@x.com', password='p', first_name='Ana', last_name='Reyes')
        self.admin = User.objects.create_user(email='a@x.com', password='p', first_name='Ad', last_name='Min', role='lgu_admin')
        self.api = APIClient()

    def commit(self):
        return self.captureOnCommitCallbacks(execute=True)

    def get(self, user, url):
        self.api.force_authenticate(user)
        return self.api.get(url)


class ReviewLogTests(Base):
    def setUp(self):
        super().setUp()
        self.sub = ProgramSubmission.objects.create(
            submitted_by=self.youth, submitter_type='sk', title='Clean-up Drive')
        with self.commit():
            self.log = SubmissionReviewLog.objects.create(
                submission=self.sub, action='submitted', notes='Submitted for review.', actor=self.youth)
        self.url = f'/api/ledger/review-logs/{self.sub.pk}/'

    def result(self, user=None):
        r = self.get(user or self.youth, self.url)
        self.assertEqual(r.status_code, 200)
        return r.data['results'][str(self.log.pk)]

    def test_entry_is_anchored_and_verified(self):
        self.assertEqual(Anchor.objects.get(kind='review_log').status, 'anchored')
        self.assertEqual(self.result()['status'], 'verified')

    def test_admin_can_check_too(self):
        self.assertEqual(self.result(self.admin)['status'], 'verified')

    def test_other_youth_cannot_see_it(self):
        self.assertEqual(self.get(self.other, self.url).status_code, 404)

    def test_rewriting_history_is_detected(self):
        SubmissionReviewLog.objects.filter(pk=self.log.pk).update(action='approved', notes='Approved.')
        self.assertEqual(self.result()['status'], 'changed')

    def test_same_record_is_not_anchored_twice(self):
        with self.commit():
            self.log.save()
        self.assertEqual(Anchor.objects.filter(kind='review_log').count(), 1)

    def test_tampering_with_the_ledger_itself_is_detected(self):
        LedgerEntry.objects.update(payload_hash='f' * 64)
        self.assertEqual(self.result()['status'], 'tampered')

    def test_a_broken_chain_flags_every_later_entry(self):
        with self.commit():
            log2 = SubmissionReviewLog.objects.create(submission=self.sub, action='approved', actor=self.admin)
        LedgerEntry.objects.filter(index=0).update(prev_hash='1' * 64)
        r = self.get(self.youth, self.url).data['results']
        self.assertEqual(r[str(log2.pk)]['status'], 'tampered')


class SKRequirementTests(Base):
    def setUp(self):
        super().setUp()
        self.brgy = SKBarangay.objects.create(barangay_name='Barangay 5')
        self.req = SKRequirement.objects.create(barangay=self.brgy, requirement_type='cbydp')
        with self.commit():
            self.req.file = SimpleUploadedFile('cbydp.pdf', b'%PDF original')
            self.req.status = 'submitted'
            self.req.submitted_at = timezone.now()
            self.req.save()

    def result(self):
        r = self.get(self.admin, '/api/ledger/sk-requirements/')
        self.assertEqual(r.status_code, 200)
        return r.data['results'][str(self.req.pk)]

    def test_submitted_file_is_anchored_and_verified(self):
        self.assertEqual(self.result()['status'], 'verified')

    def test_pending_requirement_is_not_anchored(self):
        SKRequirement.objects.create(barangay=self.brgy, requirement_type='abyip')
        self.assertEqual(Anchor.objects.filter(kind='sk_requirement').count(), 1)

    def test_swapping_the_file_on_disk_is_detected(self):
        with open(self.req.file.path, 'wb') as fh:
            fh.write(b'%PDF forged')
        self.assertEqual(self.result()['status'], 'changed')

    def test_deleting_the_file_is_detected(self):
        os.remove(self.req.file.path)
        self.assertEqual(self.result()['status'], 'changed')

    def test_only_admins_can_check(self):
        self.assertEqual(self.get(self.youth, '/api/ledger/sk-requirements/').status_code, 403)


class IDDecisionTests(Base):
    def setUp(self):
        super().setUp()
        with self.commit():
            self.v = IDVerification.objects.create(
                user=self.youth, id_type='national_id', status='approved', ai_verdict='approved',
                ai_confidence=0.9, reviewed_by=self.admin, reviewed_at=timezone.now(),
                id_image=SimpleUploadedFile('id.jpg', b'jpegbytes'))

    def result(self):
        return self.get(self.admin, '/api/ledger/id-verifications/').data['results'][str(self.v.pk)]

    def test_decision_is_anchored_and_verified(self):
        self.assertEqual(self.result()['status'], 'verified')

    def test_reviewing_status_is_not_anchored(self):
        with self.commit():
            IDVerification.objects.create(user=self.other, id_type='passport', status='reviewing')
        self.assertEqual(Anchor.objects.filter(kind='id_decision').count(), 1)

    def test_flipping_a_rejection_to_approval_is_detected(self):
        IDVerification.objects.filter(pk=self.v.pk).update(status='rejected')
        self.assertEqual(self.result()['status'], 'changed')

    def test_a_later_legitimate_decision_gets_its_own_anchor(self):
        with self.commit():
            self.v.status = 'rejected'
            self.v.admin_notes = 'Blurry photo'
            self.v.save()
        self.assertEqual(Anchor.objects.filter(kind='id_decision', ref=str(self.v.pk)).count(), 2)
        self.assertEqual(self.result()['status'], 'verified')


class AuditDayTests(Base):
    def setUp(self):
        super().setUp()
        yesterday = timezone.now() - timedelta(days=1)
        self.rows = [AuditLog.objects.create(user=self.admin, action=f'act{i}', model_name='X', details={'i': i})
                     for i in range(3)]
        AuditLog.objects.filter(pk__in=[r.pk for r in self.rows]).update(created_at=yesterday)
        self.today_row = AuditLog.objects.create(user=self.admin, action='today')   # still open
        self.day = timezone.localtime(yesterday).date().isoformat()

    def days(self):
        with self.commit():                      # the first read anchors any finished day...
            self.get(self.admin, '/api/ledger/audit-days/')
        r = self.get(self.admin, '/api/ledger/audit-days/')      # ...the second shows the result
        self.assertEqual(r.status_code, 200)
        return {d['day']: d for d in r.data['days']}

    def test_each_day_is_listed_once_however_many_entries_it_has(self):
        self.days()
        r = self.get(self.admin, '/api/ledger/audit-days/')
        self.assertEqual(len(r.data['days']), 1)             # 3 entries, 1 day
        self.assertEqual(r.data['days'][0]['count'], 3)

    def test_finished_day_is_anchored_and_today_is_left_open(self):
        d = self.days()
        self.assertEqual(d[self.day]['status'], 'verified')
        self.assertEqual(d[self.day]['count'], 3)
        self.assertNotIn(timezone.localdate().isoformat(), d)

    def test_editing_an_entry_is_detected(self):
        self.days()
        AuditLog.objects.filter(pk=self.rows[0].pk).update(action='nothing to see')
        self.assertEqual(self.days()[self.day]['status'], 'changed')

    def test_deleting_an_entry_is_detected(self):
        self.days()
        AuditLog.objects.filter(pk=self.rows[1].pk).delete()
        d = self.days()[self.day]
        self.assertEqual(d['status'], 'changed')
        self.assertEqual(d['count'], 2)

    def test_adding_a_backdated_entry_is_detected(self):
        self.days()
        extra = AuditLog.objects.create(user=self.admin, action='sneaky')
        AuditLog.objects.filter(pk=extra.pk).update(created_at=timezone.now() - timedelta(days=1))
        self.assertEqual(self.days()[self.day]['status'], 'changed')

    def test_an_anchored_day_is_never_re_anchored(self):
        self.days()
        AuditLog.objects.filter(pk=self.rows[0].pk).update(action='changed')
        self.days()
        self.assertEqual(Anchor.objects.filter(kind='audit_day').count(), 1)


class CertificateTests(Base):
    def setUp(self):
        super().setUp()
        course = Course.objects.create(title='Leadership 101', slug='lead-101', description='d', category='leadership')
        enrollment = Enrollment.objects.create(user=self.youth, course=course, status='completed')
        with self.commit():
            self.course_cert = CourseCertificate.objects.create(
                enrollment=enrollment, certificate_number='LYDO-C-001',
                file=SimpleUploadedFile('c.pdf', b'%PDF course cert'))
            self.recog_cert = RecognitionCertificate.objects.create(
                user=self.youth, title='Outstanding Youth', issued_by='LYDO', issued_at=timezone.localdate(),
                certificate_number='LYDO-R-001', file=SimpleUploadedFile('r.pdf', b'%PDF recog cert'))

    def results(self, user=None):
        r = self.get(user or self.youth, '/api/ledger/certificates/')
        self.assertEqual(r.status_code, 200)
        return r.data['results']

    def test_both_kinds_are_anchored_and_verified(self):
        res = self.results()
        self.assertEqual(res[f'course-{self.course_cert.pk}']['status'], 'verified')
        self.assertEqual(res[f'recognition-{self.recog_cert.pk}']['status'], 'verified')

    def test_swapping_the_certificate_file_is_detected(self):
        with open(self.course_cert.file.path, 'wb') as fh:
            fh.write(b'%PDF forged')
        self.assertEqual(self.results()[f'course-{self.course_cert.pk}']['status'], 'changed')

    def test_changing_the_holder_or_title_is_detected(self):
        RecognitionCertificate.objects.filter(pk=self.recog_cert.pk).update(user=self.other)
        CourseCertificate.objects.filter(pk=self.course_cert.pk).update(certificate_number='LYDO-C-999')
        res = self.results(self.admin)
        self.assertEqual(res[f'recognition-{self.recog_cert.pk}']['status'], 'changed')
        self.assertEqual(res[f'course-{self.course_cert.pk}']['status'], 'changed')

    def test_youth_only_see_their_own_and_admins_see_all(self):
        self.assertEqual(self.results(self.other), {})
        self.assertEqual(len(self.results(self.admin)), 2)

    def test_backfill_covers_certificates(self):
        Anchor.objects.all().delete()
        call_command('anchor_ledger', '--backfill')
        self.assertEqual(Anchor.objects.filter(kind__in=['course_cert', 'recognition_cert'], status='anchored').count(), 2)


class BackfillAndStatusTests(Base):
    def test_backfill_anchors_existing_records_and_status_reports_them(self):
        sub = ProgramSubmission.objects.create(submitted_by=self.youth, submitter_type='sk', title='T')
        with mock.patch('apps.ledger.signals.record'):       # simulate records from before anchoring
            SubmissionReviewLog.objects.create(submission=sub, action='submitted', actor=self.youth)
        self.assertEqual(Anchor.objects.count(), 0)
        call_command('anchor_ledger', '--backfill')
        self.assertEqual(Anchor.objects.filter(kind='review_log', status='anchored').count(), 1)
        r = self.get(self.admin, '/api/ledger/status/')
        self.assertEqual(r.data['by_kind']['review_log']['anchored'], 1)
        self.assertTrue(r.data['local_chain_intact'])

    def test_signal_failure_never_breaks_the_request(self):
        sub = ProgramSubmission.objects.create(submitted_by=self.youth, submitter_type='sk', title='T')
        with mock.patch('apps.ledger.signals.record', side_effect=RuntimeError('boom')):
            SubmissionReviewLog.objects.create(submission=sub, action='submitted', actor=self.youth)


class FakeChain:
    """Just enough of web3 to exercise the EVM path without a network."""
    def __init__(self):
        self.txs = {}
        self._sent = 0
        self.eth = SimpleNamespace(
            account=SimpleNamespace(from_key=lambda k: SimpleNamespace(
                address='0xabc', sign_transaction=lambda tx: SimpleNamespace(raw_transaction=tx))),
            get_transaction_count=lambda a: 0,
            gas_price=1,
            send_raw_transaction=self._send,
            wait_for_transaction_receipt=lambda h, timeout: {'status': 1, 'blockNumber': 77},
            get_transaction=lambda h: {'input': self.txs[h]['data']},
            get_transaction_receipt=lambda h: {'status': 1, 'blockNumber': 77},
        )

    def _send(self, raw):
        # One distinct hash per transaction; the first is '0x' + 'ab' * 32.
        h = '0x' + format(0xab + self._sent, '02x') * 32
        self._sent += 1
        self.txs[h] = raw

        class H(bytes):
            def hex(_):
                return h
        return H(b'x')


@override_settings(ANCHOR_BACKEND='evm', ANCHOR_RPC_URL='http://fake', ANCHOR_PRIVATE_KEY='0x1',
                   ANCHOR_NETWORK_NAME='Polygon Amoy (testnet)', ANCHOR_CHAIN_ID=80002)
class EvmTests(Base):
    def setUp(self):
        super().setUp()
        self.chain = FakeChain()
        for p in (mock.patch.object(service, '_w3', return_value=self.chain),
                  mock.patch.object(service.threading, 'Thread',
                                    side_effect=lambda target, args, daemon: SimpleNamespace(start=lambda: target(*args)))):
            p.start()
            self.addCleanup(p.stop)
        self.sub = ProgramSubmission.objects.create(submitted_by=self.youth, submitter_type='sk', title='T')
        with self.commit():
            self.log = SubmissionReviewLog.objects.create(submission=self.sub, action='submitted', actor=self.youth)

    def result(self):
        return self.get(self.youth, f'/api/ledger/review-logs/{self.sub.pk}/').data['results'][str(self.log.pk)]

    def test_fingerprint_goes_on_chain_as_transaction_data_and_is_read_back(self):
        a = Anchor.objects.get(kind='review_log')
        self.assertEqual((a.status, a.network, a.block), ('anchored', 'Polygon Amoy (testnet)', 77))
        self.assertEqual(self.chain.txs['0x' + 'ab' * 32]['data'], service.DATA_PREFIX + bytes.fromhex(a.content_hash))
        r = self.result()
        self.assertEqual(r['status'], 'verified')
        self.assertTrue(r['explorer_url'].startswith('https://amoy.polygonscan.com/tx/0x'))

    def test_a_different_hash_on_chain_is_flagged(self):
        self.chain.txs['0x' + 'ab' * 32]['data'] = service.DATA_PREFIX + b'\x00' * 32
        self.assertEqual(self.result()['status'], 'tampered')

    def test_outage_marks_failed_and_retry_recovers(self):
        with mock.patch.object(service, 'evm_send', side_effect=RuntimeError('rpc down')):
            with self.commit():
                self.log2 = SubmissionReviewLog.objects.create(submission=self.sub, action='approved', actor=self.admin)
        a = Anchor.objects.get(kind='review_log', ref=str(self.log2.pk))
        self.assertEqual(a.status, 'failed')
        self.assertEqual(self.get(self.youth, f'/api/ledger/review-logs/{self.sub.pk}/').data['results'][str(self.log2.pk)]['status'], 'failed')
        service.retry_unanchored()
        a.refresh_from_db()
        self.assertEqual(a.status, 'anchored')


class PPASubmissionTests(Base):
    def setUp(self):
        super().setUp()
        self.sub = ProgramSubmission.objects.create(
            submitted_by=self.youth, submitter_type='sk', title='Clean-up Drive',
            objectives='Clean the river', estimated_budget='15000.00', status='draft')
        self.url = f'/api/ledger/submission-content/{self.sub.pk}/'

    def submit(self):
        self.sub.status = 'pending'
        self.sub.save()
        with self.commit():
            SubmissionReviewLog.objects.create(submission=self.sub, action='submitted', actor=self.youth)

    def status(self, user=None):
        r = self.get(user or self.youth, self.url)
        self.assertEqual(r.status_code, 200)
        return r.data['result']['status']

    def test_draft_is_not_applicable_and_not_anchored(self):
        self.assertEqual(self.status(), 'not_applicable')
        self.assertFalse(Anchor.objects.filter(kind='ppa_submission').exists())

    def test_submission_is_anchored_and_verified(self):
        self.submit()
        self.assertEqual(Anchor.objects.get(kind='ppa_submission').status, 'anchored')
        self.assertEqual(self.status(), 'verified')

    def test_silent_edit_after_submission_is_detected(self):
        self.submit()
        # Direct DB write: bypasses the app, so no signal fires (this is what tampering looks like).
        ProgramSubmission.objects.filter(pk=self.sub.pk).update(estimated_budget='99000.00')
        self.assertEqual(self.status(), 'changed')

    def test_status_and_review_changes_are_not_flagged(self):
        self.submit()
        ProgramSubmission.objects.filter(pk=self.sub.pk).update(status='approved', admin_notes='ok')
        self.assertEqual(self.status(), 'verified')

    def test_resubmission_after_revision_gets_a_new_anchor(self):
        self.submit()
        first = Anchor.objects.get(kind='ppa_submission').content_hash
        self.sub.objectives = 'Clean the river and plant trees'
        self.sub.status = 'pending'
        self.sub.save()
        with self.commit():
            SubmissionReviewLog.objects.create(submission=self.sub, action='submitted', actor=self.youth)
        self.assertEqual(Anchor.objects.filter(kind='ppa_submission').count(), 2)
        self.assertNotEqual(Anchor.objects.filter(kind='ppa_submission').first().content_hash, first)
        self.assertEqual(self.status(), 'verified')

    def test_other_youth_cannot_check_it_but_admin_can(self):
        self.submit()
        self.assertEqual(self.get(self.other, self.url).status_code, 404)
        self.assertEqual(self.status(self.admin), 'verified')


class YORPDecisionTests(Base):
    def setUp(self):
        super().setUp()
        self.org = YouthOrganization.objects.create(
            name='Lucena Youth Council', classification='community_based',
            sub_classification='youth_org', submitted_by=self.youth)
        self.url = '/api/ledger/yorp-decisions/'

    def status(self):
        r = self.get(self.admin, self.url)
        self.assertEqual(r.status_code, 200)
        return r.data['results'].get(str(self.org.pk), {}).get('status')

    def decide(self, status):
        with self.commit():
            self.org.status = status
            self.org.save()

    def test_pending_is_not_anchored(self):
        self.assertFalse(Anchor.objects.filter(kind='yorp_decision').exists())
        self.assertIsNone(self.status())

    def test_approval_is_anchored_and_verified(self):
        self.decide('approved')
        self.assertEqual(self.status(), 'verified')

    def test_silent_reversal_is_detected(self):
        self.decide('rejected')
        YouthOrganization.objects.filter(pk=self.org.pk).update(status='approved')
        self.assertEqual(self.status(), 'changed')

    def test_compliance_flag_change_is_not_flagged(self):
        self.decide('approved')
        YouthOrganization.objects.filter(pk=self.org.pk).update(is_compliant=True, description='new text')
        self.assertEqual(self.status(), 'verified')

    def test_youth_cannot_use_the_admin_endpoint(self):
        self.api.force_authenticate(self.youth)
        self.assertEqual(self.api.get(self.url).status_code, 403)
