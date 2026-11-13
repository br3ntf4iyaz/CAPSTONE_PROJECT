import tempfile

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import DEFAULT_REQUIREMENTS, OrgRequirement, YouthOrganization

User = get_user_model()
MEDIA = tempfile.mkdtemp()


def pdf(name='doc.pdf', size=100):
    return SimpleUploadedFile(name, b'%PDF-1.4 ' + b'x' * size, content_type='application/pdf')


@override_settings(MEDIA_ROOT=MEDIA)
class OrgRequirementUploadTests(TestCase):
    def setUp(self):
        self.leader = User.objects.create_user(email='lead@x.com', password='p', first_name='Lea', last_name='Der')
        self.other = User.objects.create_user(email='oth@x.com', password='p', first_name='Oth', last_name='Er')
        self.admin = User.objects.create_user(email='adm@x.com', password='p', first_name='Ad', last_name='Min', role='lgu_admin')
        self.org = YouthOrganization.objects.create(
            name='Lucena Youth Council', classification='community_based',
            sub_classification='youth_org', submitted_by=self.leader, status='pending')
        self.api = APIClient()

    def mine(self, user=None):
        self.api.force_authenticate(user or self.leader)
        r = self.api.get('/api/youth-orgs/my-submissions/')
        self.assertEqual(r.status_code, 200)
        return r.data

    def upload(self, req_id, f=None, user=None, org=None):
        self.api.force_authenticate(user or self.leader)
        return self.api.post(
            f'/api/youth-orgs/{(org or self.org).pk}/requirements/{req_id}/upload/',
            {'file': f if f is not None else pdf()}, format='multipart')

    def test_owner_sees_the_standard_checklist_with_nothing_submitted(self):
        reqs = self.mine()[0]['requirements']
        self.assertEqual([r['name'] for r in reqs], sorted(DEFAULT_REQUIREMENTS))
        self.assertFalse(any(r['is_submitted'] for r in reqs))

    def test_checklist_is_created_once_not_duplicated(self):
        self.mine(); self.mine()
        self.assertEqual(self.org.requirements.count(), len(DEFAULT_REQUIREMENTS))

    def test_uploading_a_pdf_marks_the_requirement_submitted(self):
        rid = self.mine()[0]['requirements'][0]['id']
        r = self.upload(rid)
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data['is_submitted'])
        req = OrgRequirement.objects.get(pk=rid)
        self.assertTrue(req.file.name.endswith('.pdf'))
        self.assertIsNotNone(req.submitted_at)
        done = [x for x in self.mine()[0]['requirements'] if x['is_submitted']]
        self.assertEqual(len(done), 1)

    def test_only_pdfs_are_accepted(self):
        rid = self.mine()[0]['requirements'][0]['id']
        bad = SimpleUploadedFile('virus.exe', b'MZ', content_type='application/octet-stream')
        self.assertEqual(self.upload(rid, bad).status_code, 400)
        self.assertFalse(OrgRequirement.objects.get(pk=rid).is_submitted)

    def test_a_file_is_required(self):
        rid = self.mine()[0]['requirements'][0]['id']
        self.api.force_authenticate(self.leader)
        r = self.api.post(f'/api/youth-orgs/{self.org.pk}/requirements/{rid}/upload/', {}, format='multipart')
        self.assertEqual(r.status_code, 400)

    def test_someone_elses_organization_cannot_be_uploaded_to(self):
        rid = self.mine()[0]['requirements'][0]['id']
        self.assertEqual(self.upload(rid, user=self.other).status_code, 404)
        self.assertEqual(self.mine(self.other), [])

    def test_a_requirement_of_another_org_cannot_be_targeted(self):
        other_org = YouthOrganization.objects.create(
            name='Other Org', classification='school_based', sub_classification='youth_org',
            submitted_by=self.leader, status='pending')
        self.mine()
        foreign = other_org.requirements.first().pk
        self.assertEqual(self.upload(foreign).status_code, 404)

    def test_rejected_application_cannot_upload(self):
        rid = self.mine()[0]['requirements'][0]['id']
        YouthOrganization.objects.filter(pk=self.org.pk).update(status='rejected')
        self.assertEqual(self.upload(rid).status_code, 400)

    def test_anonymous_cannot_upload(self):
        rid = self.mine()[0]['requirements'][0]['id']
        anon = APIClient()
        r = anon.post(f'/api/youth-orgs/{self.org.pk}/requirements/{rid}/upload/', {'file': pdf()}, format='multipart')
        self.assertIn(r.status_code, (401, 403))

    def test_admin_sees_the_upload_in_the_org_list(self):
        rid = self.mine()[0]['requirements'][0]['id']
        self.upload(rid)
        self.api.force_authenticate(self.admin)
        r = self.api.get('/api/youth-orgs/')
        self.assertEqual(r.status_code, 200)
        rows = r.data['results'] if isinstance(r.data, dict) else r.data
        row = next(o for o in rows if o['id'] == self.org.pk)
        self.assertEqual(row['requirements_submitted'], 1)
        self.assertEqual(row['requirements_total'], len(DEFAULT_REQUIREMENTS))
