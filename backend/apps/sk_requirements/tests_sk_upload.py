import tempfile

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.ledger.models import Anchor

from .models import REQUIREMENT_CHOICES, SKBarangay, SKRequirement

User = get_user_model()
MEDIA = tempfile.mkdtemp()


def pdf(name='cbydp.pdf'):
    return SimpleUploadedFile(name, b'%PDF-1.4 ' + b'x' * 200, content_type='application/pdf')


def make_user(email, youth_type, barangay=''):
    u = User.objects.create_user(email=email, password='p', first_name='T', last_name='U', youth_type=youth_type)
    if barangay:
        u.profile.barangay = barangay
        u.profile.save()
    return u


@override_settings(MEDIA_ROOT=MEDIA)
class SKRequirementUploadTests(TestCase):
    def setUp(self):
        self.b1 = SKBarangay.objects.create(barangay_name='Barangay 1')
        self.b2 = SKBarangay.objects.create(barangay_name='Barangay 2')
        self.sk1 = make_user('sk1@x.com', 'sk', 'barangay 1')       # profile spelling differs in case
        self.sk2 = make_user('sk2@x.com', 'sk', 'Barangay 2')
        self.youth = make_user('y@x.com', 'general_youth', 'Barangay 1')
        self.sk_nobrgy = make_user('sk3@x.com', 'sk', '')
        self.admin = User.objects.create_user(email='a@x.com', password='p', first_name='Ad', last_name='M', role='lgu_admin')
        self.api = APIClient()

    def mine(self, user):
        self.api.force_authenticate(user)
        return self.api.get('/api/sk-requirements/requirements/mine/')

    def upload(self, user, req_id, f=None):
        self.api.force_authenticate(user)
        return self.api.post(f'/api/sk-requirements/requirements/{req_id}/upload/',
                             {'file': f if f is not None else pdf()}, format='multipart')

    def first_id(self, user=None):
        return self.mine(user or self.sk1).data['requirements'][0]['id']

    def test_sk_sees_the_full_checklist_for_their_barangay(self):
        r = self.mine(self.sk1)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['barangay']['name'], 'Barangay 1')
        self.assertEqual([x['type'] for x in r.data['requirements']], [c for c, _ in REQUIREMENT_CHOICES])
        self.assertEqual(r.data['summary'], {'submitted': 0, 'total': len(REQUIREMENT_CHOICES)})
        self.assertTrue(all(x['status'] == 'pending' for x in r.data['requirements']))

    def test_checklist_is_not_duplicated_by_repeated_visits(self):
        self.mine(self.sk1); self.mine(self.sk1)
        self.assertEqual(self.b1.requirements.count(), len(REQUIREMENT_CHOICES))

    def test_general_youth_and_sk_without_barangay_are_refused(self):
        self.assertEqual(self.mine(self.youth).status_code, 403)
        self.assertEqual(self.mine(self.sk_nobrgy).status_code, 403)
        self.api.force_authenticate(None)
        self.assertIn(self.api.get('/api/sk-requirements/requirements/mine/').status_code, (401, 403))

    def test_upload_marks_it_submitted_and_updates_the_summary(self):
        rid = self.first_id()
        r = self.upload(self.sk1, rid)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['status'], 'submitted')
        req = SKRequirement.objects.get(pk=rid)
        self.assertTrue(req.file.name.endswith('.pdf'))
        self.assertIsNotNone(req.submitted_at)
        self.assertEqual(self.mine(self.sk1).data['summary']['submitted'], 1)

    def test_upload_is_fingerprinted_on_the_ledger_and_verifies(self):
        rid = self.first_id()
        with self.captureOnCommitCallbacks(execute=True):
            self.upload(self.sk1, rid)
        self.assertEqual(Anchor.objects.get(kind='sk_requirement', ref=str(rid)).status, 'anchored')
        self.api.force_authenticate(self.admin)
        res = self.api.get('/api/ledger/sk-requirements/').data['results'][str(rid)]
        self.assertEqual(res['status'], 'verified')

    def test_only_pdfs_and_a_file_are_accepted(self):
        rid = self.first_id()
        bad = SimpleUploadedFile('x.exe', b'MZ', content_type='application/octet-stream')
        self.assertEqual(self.upload(self.sk1, rid, bad).status_code, 400)
        self.api.force_authenticate(self.sk1)
        self.assertEqual(self.api.post(f'/api/sk-requirements/requirements/{rid}/upload/', {}, format='multipart').status_code, 400)
        self.assertEqual(SKRequirement.objects.get(pk=rid).status, 'pending')

    def test_another_barangays_sk_cannot_upload_to_this_requirement(self):
        rid = self.first_id()
        self.mine(self.sk2)
        self.assertEqual(self.upload(self.sk2, rid).status_code, 404)
        self.assertEqual(SKRequirement.objects.get(pk=rid).status, 'pending')

    def test_general_youth_cannot_upload(self):
        rid = self.first_id()
        self.assertEqual(self.upload(self.youth, rid).status_code, 404)

    def test_overdue_pending_items_show_as_overdue(self):
        self.mine(self.sk1)
        SKRequirement.objects.filter(barangay=self.b1, requirement_type='abyip').update(due_date='2020-01-01')
        statuses = {x['type']: x['status'] for x in self.mine(self.sk1).data['requirements']}
        self.assertEqual(statuses['abyip'], 'overdue')

    def test_admin_endpoints_remain_admin_only(self):
        self.api.force_authenticate(self.sk1)
        self.assertEqual(self.api.get('/api/sk-requirements/requirements/').status_code, 403)
        self.assertEqual(self.api.get('/api/sk-requirements/barangays/compliance_summary/').status_code, 403)
