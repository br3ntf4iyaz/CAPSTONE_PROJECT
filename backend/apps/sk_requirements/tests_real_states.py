import io
import shutil
import tempfile

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import AuditLog
from apps.compliance.models import SKComplianceRecord
from apps.notifications.models import Notification

from .models import REQUIREMENT_CHOICES, SKBarangay, SKRequirement

User = get_user_model()
TMP = tempfile.mkdtemp()


def pdf(name='doc.pdf'):
    return SimpleUploadedFile(name, b'%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF', content_type='application/pdf')


@override_settings(MEDIA_ROOT=TMP, PRIVATE_MEDIA_ROOT=TMP)
class RealComplianceStateTests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TMP, ignore_errors=True)

    def setUp(self):
        self.a = SKBarangay.objects.create(barangay_name='Barangay A', sk_chairperson='Chair A')
        self.b = SKBarangay.objects.create(barangay_name='Barangay B', sk_chairperson='Chair B')
        for brgy in (self.a, self.b):
            for code, _ in REQUIREMENT_CHOICES:
                # what the old seed did: marked submitted with a date but no file and no review
                SKRequirement.objects.create(barangay=brgy, requirement_type=code, status='submitted', submitted_at=timezone.now())
        self.admin = User.objects.create_user(email='ad@t.local', password='x', role='lgu_admin', is_active=True)
        self.sk_a = self.make_sk('ska@t.local', 'Barangay A')
        self.sk_b = self.make_sk('skb@t.local', 'Barangay B')
        self.ac, self.ska, self.skb, self.anon = APIClient(), APIClient(), APIClient(), APIClient()
        self.ac.force_authenticate(self.admin)
        self.ska.force_authenticate(self.sk_a)
        self.skb.force_authenticate(self.sk_b)

    def make_sk(self, email, barangay):
        u = User.objects.create_user(email=email, password='x', role='youth', youth_type='sk', is_active=True)
        u.profile.barangay = barangay
        u.profile.save()
        return u

    def req(self, brgy, code):
        return SKRequirement.objects.get(barangay=brgy, requirement_type=code)

    def directory(self, brgy):
        data = self.anon.get('/api/sk-requirements/barangays/').data
        return next(b for b in data if b['id'] == brgy.id)

    def row(self, brgy, code):
        return next(r for r in self.directory(brgy)['requirements'] if r['key'] == code)

    # TEST 1, 8: demo rows are not submissions
    def test_placeholder_rows_are_never_shown_or_counted_as_submitted(self):
        d = self.directory(self.a)
        self.assertEqual((d['submitted_count'], d['total_requirements']), (0, 10))
        self.assertTrue(all(r['status'] in ('not_submitted', 'overdue') for r in d['requirements']))
        self.assertEqual(self.row(self.a, 'annex_h')['status'], 'not_submitted')
        self.assertEqual(d['pending_count'] + d['overdue_count'], 10)

    # TEST 2, 4, 9
    def test_an_upload_waits_for_lydo_and_only_a_verified_document_counts(self):
        r = self.req(self.a, 'annex_h')
        up = self.ska.post(f'/api/sk-requirements/requirements/{r.pk}/upload/', {'file': pdf(), 'remarks': 'Annex H for 2026'}, format='multipart')
        self.assertEqual(up.status_code, 200, up.data)
        self.assertEqual(self.row(self.a, 'annex_h')['status'], 'submitted')  # waiting for LYDO
        self.assertEqual(self.directory(self.a)['submitted_count'], 0)  # an upload is not completion
        self.assertTrue(Notification.objects.filter(user=self.admin, title='New SK document submitted').exists())
        # nobody but LYDO can approve
        self.assertEqual(self.ska.post(f'/api/sk-requirements/requirements/{r.pk}/review/', {'decision': 'approve'}, format='json').status_code, 403)
        ok = self.ac.post(f'/api/sk-requirements/requirements/{r.pk}/review/', {'decision': 'approve', 'remarks': 'Complete'}, format='json')
        self.assertEqual(ok.status_code, 200, ok.data)
        self.assertEqual(self.row(self.a, 'annex_h')['status'], 'verified')
        d = self.directory(self.a)
        self.assertEqual(d['submitted_count'], 1)
        self.assertEqual(d['submitted_count'] + d['pending_count'] + d['overdue_count'], 10)
        self.assertEqual(self.directory(self.b)['submitted_count'], 0)  # the other barangay is untouched
        self.assertTrue(Notification.objects.filter(user=self.sk_a, title='Document verified').exists())

    def test_a_document_under_review_or_verified_is_not_silently_replaced(self):
        r = self.req(self.a, 'policies')
        url = f'/api/sk-requirements/requirements/{r.pk}/upload/'
        self.assertEqual(self.ska.post(url, {'file': pdf()}, format='multipart').status_code, 200)
        self.assertEqual(self.ska.post(url, {'file': pdf('again.pdf')}, format='multipart').status_code, 409)  # under review
        self.ac.post(f'/api/sk-requirements/requirements/{r.pk}/review/', {'decision': 'approve'}, format='json')
        self.assertEqual(self.ska.post(url, {'file': pdf('again.pdf')}, format='multipart').status_code, 409)  # verified

    # TEST 5, 6
    def test_a_returned_document_can_be_corrected_and_the_history_is_kept(self):
        r = self.req(self.a, 'minutes')
        url = f'/api/sk-requirements/requirements/{r.pk}/upload/'
        self.ska.post(url, {'file': pdf('first.pdf')}, format='multipart')
        first_file = SKRequirement.objects.get(pk=r.pk).file.name
        bad = self.ac.post(f'/api/sk-requirements/requirements/{r.pk}/review/', {'decision': 'return', 'remarks': ''}, format='json')
        self.assertEqual(bad.status_code, 400)  # a return needs remarks
        self.assertEqual(self.ac.post(f'/api/sk-requirements/requirements/{r.pk}/review/', {'decision': 'return', 'remarks': 'The signature page is missing.'}, format='json').status_code, 200)
        row = self.row(self.a, 'minutes')
        self.assertEqual((row['status'], row['remarks']), ('returned', 'The signature page is missing.'))
        self.assertTrue(Notification.objects.filter(user=self.sk_a, title='Document returned for correction').exists())
        self.assertEqual(self.directory(self.a)['submitted_count'], 0)
        self.assertEqual(self.ska.post(url, {'file': pdf('second.pdf'), 'remarks': 'Signature page added'}, format='multipart').status_code, 200)
        self.assertEqual(self.row(self.a, 'minutes')['status'], 'submitted')
        log = list(AuditLog.objects.filter(action='sk_requirement_submitted', object_id=r.pk).order_by('id'))
        self.assertEqual(len(log), 2)
        self.assertEqual(log[1].details['replaced']['file'], first_file)  # the earlier file is on record
        self.assertEqual(log[1].details['replaced']['remarks_from_lydo'], 'The signature page is missing.')
        self.assertTrue(AuditLog.objects.filter(action='sk_requirement_returned', object_id=r.pk).exists())

    # TEST 7
    def test_a_barangay_cannot_touch_another_barangays_documents(self):
        r = self.req(self.a, 'annex_h')
        self.assertEqual(self.skb.post(f'/api/sk-requirements/requirements/{r.pk}/upload/', {'file': pdf()}, format='multipart').status_code, 404)
        self.ska.post(f'/api/sk-requirements/requirements/{r.pk}/upload/', {'file': pdf()}, format='multipart')
        self.assertEqual(self.skb.get(f'/api/sk-requirements/requirements/{r.pk}/file/').status_code, 404)
        self.assertEqual(self.ska.get(f'/api/sk-requirements/requirements/{r.pk}/file/').status_code, 200)
        self.assertEqual(self.ac.get(f'/api/sk-requirements/requirements/{r.pk}/file/').status_code, 200)
        self.assertIn(self.anon.get(f'/api/sk-requirements/requirements/{r.pk}/file/').status_code, (401, 403))
        mine_b = self.skb.get('/api/sk-requirements/requirements/mine/').data
        self.assertEqual(mine_b['barangay']['id'], self.b.id)

    def test_rcb_and_mil_are_not_submitted_through_the_simple_upload(self):
        r = self.req(self.a, 'quarterly_cash')
        self.assertEqual(self.ska.post(f'/api/sk-requirements/requirements/{r.pk}/upload/', {'file': pdf()}, format='multipart').status_code, 400)

    def test_the_sk_page_shows_the_honest_checklist(self):
        mine = self.ska.get('/api/sk-requirements/requirements/mine/').data
        self.assertEqual(mine['summary']['completed'], 0)
        self.assertTrue(all(i['status'] != 'verified' for i in mine['requirements']))
        annex = next(i for i in mine['requirements'] if i['type'] == 'annex_h')
        self.assertTrue(annex['can_submit'])
        self.assertFalse(next(i for i in mine['requirements'] if i['type'] == 'monthly_pr')['can_submit'])

    def test_admin_sees_what_is_waiting(self):
        r = self.req(self.a, 'kk_assembly')
        self.ska.post(f'/api/sk-requirements/requirements/{r.pk}/upload/', {'file': pdf()}, format='multipart')
        waiting = self.ac.get('/api/sk-requirements/requirements/awaiting/').data
        self.assertEqual([w['id'] for w in waiting], [r.pk])
        self.assertIn(self.ska.get('/api/sk-requirements/requirements/awaiting/').status_code, (401, 403))

    # compliance-monitored documents follow the compliance workflow
    def test_a_monitored_document_counts_only_when_the_compliance_record_is_verified(self):
        r = self.req(self.a, 'cbydp')
        self.assertEqual(self.ska.post(f'/api/sk-requirements/requirements/{r.pk}/upload/', {'file': pdf()}, format='multipart').status_code, 200)
        self.assertEqual(self.row(self.a, 'cbydp')['status'], 'submitted')
        self.assertEqual(self.directory(self.a)['submitted_count'], 0)
        SKComplianceRecord.objects.filter(barangay=self.a, category='cbydp').update(status='verified', reviewed_at=timezone.now())
        self.assertEqual(self.row(self.a, 'cbydp')['status'], 'verified')
        self.assertEqual(self.directory(self.a)['submitted_count'], 1)

    def test_the_cleanup_command_resets_only_demo_rows_and_deletes_nothing(self):
        real = self.req(self.a, 'annex_h')
        self.ska.post(f'/api/sk-requirements/requirements/{real.pk}/upload/', {'file': pdf()}, format='multipart')
        before = SKRequirement.objects.count()
        out = io.StringIO()
        call_command('reset_sk_placeholders', stdout=out)  # dry run
        self.assertIn('Nothing changed', out.getvalue())
        self.assertEqual(SKRequirement.objects.filter(status='submitted').count(), 20)
        call_command('reset_sk_placeholders', '--yes', stdout=io.StringIO())
        self.assertEqual(SKRequirement.objects.count(), before)
        self.assertEqual(SKRequirement.objects.get(pk=real.pk).status, 'submitted')  # the real upload stays
        self.assertTrue(SKRequirement.objects.get(pk=real.pk).file)
        self.assertEqual(SKRequirement.objects.filter(status='submitted').count(), 1)  # only the real upload is still "submitted"
