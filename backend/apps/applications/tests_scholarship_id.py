import json
import shutil

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework.test import APITestCase

from apps.accounts.models import AuditLog, User
from apps.notifications.models import Notification
from apps.resources.models import Scholarship
from apps.verification.models import IDVerification

from .models import ScholarshipApplication
from .tests_scholarship import EDUCATION, FAMILY, PERSONAL, TMP, png


def pdf(name='id.pdf'):
    return SimpleUploadedFile(name, b'%PDF-1.4 test', content_type='application/pdf')


@override_settings(PRIVATE_MEDIA_ROOT=TMP, MEDIA_ROOT=TMP)
class ScholarshipIdDocumentTests(APITestCase):
    URL = '/api/applications/scholarship/'

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TMP, ignore_errors=True)

    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(email='a@x.com', password='p', role='youth', is_active=True)
        self.other = User.objects.create_user(email='b@x.com', password='p', role='youth', is_active=True)
        self.admin = User.objects.create_user(email='ad@x.com', password='p', role='lgu_admin', is_active=True)
        for u in (self.user, self.other):
            IDVerification.objects.create(user=u, id_type='umid', status='approved')
        self.sch = Scholarship.objects.create(
            title='Test Grant', provider='P', provider_type='government', coverage='c', amount='a', slots='s',
            required_documents=['valid_id'], optional_documents=[], requires_gwa=False)

    def payload(self, **over):
        data = {'scholarship': self.sch.id, 'personal': json.dumps(PERSONAL), 'education': json.dumps(EDUCATION), 'family': json.dumps(FAMILY),
                'consent_given': 'true', 'id_confirmed': 'true', 'valid_id_type': 'umid', 'valid_id_source': 'camera', 'doc_valid_id': png('scan.png')}
        data.update(over)
        return {k: v for k, v in data.items() if v is not None}

    def apply(self, **over):
        self.client.force_authenticate(self.user)
        return self.client.post(self.URL, self.payload(**over), format='multipart')

    def doc(self, r):
        return r.data['documents'][0]

    def test_a_camera_capture_and_an_upload_are_saved_the_same_way(self):
        r = self.apply()
        self.assertEqual(r.status_code, 201, r.data)
        d = self.doc(r)
        self.assertEqual((d['id_type'], d['source'], d['review_status']), ('umid', 'camera', 'pending'))
        self.client.force_authenticate(self.other)
        r2 = self.client.post(self.URL, self.payload(valid_id_source='upload', valid_id_type='other_gov', valid_id_other='Senior ID <b>x</b>', doc_valid_id=pdf()), format='multipart')
        self.assertEqual(r2.status_code, 201, r2.data)
        d2 = self.doc(r2)
        self.assertEqual((d2['source'], d2['id_type_other']), ('upload', 'Senior ID x'))

    def test_the_id_is_required_and_must_be_confirmed(self):
        self.assertEqual(self.apply(doc_valid_id=None).status_code, 400)
        r = self.apply(id_confirmed=None)
        self.assertEqual(r.status_code, 400)
        self.assertIn('confirm', str(r.data).lower())
        self.assertFalse(ScholarshipApplication.objects.exists())

    def test_the_id_type_is_optional_but_must_be_a_listed_one(self):
        self.assertEqual(self.apply(valid_id_type=None).status_code, 201)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.post(self.URL, self.payload(valid_id_type='library_card'), format='multipart').status_code, 400)

    def test_backend_rejects_the_wrong_file_types_and_fake_files(self):
        self.assertEqual(self.apply(doc_valid_id=SimpleUploadedFile('id.exe', b'MZ', content_type='application/octet-stream')).status_code, 400)
        self.assertEqual(self.apply(doc_valid_id=SimpleUploadedFile('id.png', b'not really an image', content_type='image/png')).status_code, 400)
        self.assertEqual(self.apply(doc_valid_id=SimpleUploadedFile('id.pdf', b'not a pdf', content_type='application/pdf')).status_code, 400)
        self.assertEqual(self.apply(doc_valid_id=SimpleUploadedFile('big.pdf', b'%PDF' + b'0' * (5 * 1024 * 1024 + 1), content_type='application/pdf')).status_code, 400)

    def test_revision_replacement_and_history(self):
        app_id = self.apply().data['id']
        doc_id = ScholarshipApplication.objects.get(pk=app_id).documents.get().pk
        self.client.force_authenticate(self.admin)
        review = f'{self.URL}{app_id}/documents/{doc_id}/review/'
        self.assertEqual(self.client.post(review, {'status': 'needs_revision'}, format='json').status_code, 400)  # an explanation is needed
        r = self.client.post(review, {'status': 'needs_revision', 'note': 'The ID is blurry. Please send a clearer image.'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data['status'], 'for_compliance')
        n = Notification.objects.filter(user=self.user).latest('id')
        self.assertIn('blurry', n.message)
        self.assertTrue(AuditLog.objects.filter(action='scholarship_document_reviewed').exists())
        # the applicant replaces only the ID, with no new application
        self.client.force_authenticate(self.user)
        r = self.client.post(f'{self.URL}{app_id}/comply/', {'doc_valid_id': png('new.png'), 'valid_id_type': 'passport', 'valid_id_source': 'upload', 'id_confirmed': 'true'}, format='multipart')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(ScholarshipApplication.objects.count(), 1)
        self.assertEqual(r.data['status'], 'under_review')
        docs = r.data['documents']
        self.assertEqual(len(docs), 2)  # the first copy stays in the history
        old, new = [d for d in docs if d['superseded']][0], [d for d in docs if not d['superseded']][0]
        self.assertEqual((old['review_status'], new['review_status'], new['id_type']), ('needs_revision', 'pending', 'passport'))
        self.assertEqual(old['review_note'], 'The ID is blurry. Please send a clearer image.')
        # an old copy can no longer be reviewed, the new one can
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.post(review, {'status': 'verified'}, format='json').status_code, 400)
        new_review = f'{self.URL}{app_id}/documents/{new["id"]}/review/'
        self.assertEqual(self.client.post(new_review, {'status': 'verified'}, format='json').status_code, 200)

    def test_a_replacement_must_be_confirmed_too(self):
        app_id = self.apply().data['id']
        doc_id = ScholarshipApplication.objects.get(pk=app_id).documents.get().pk
        self.client.force_authenticate(self.admin)
        self.client.post(f'{self.URL}{app_id}/documents/{doc_id}/review/', {'status': 'invalid', 'note': 'This is not an ID at all'}, format='json')
        self.client.force_authenticate(self.user)
        r = self.client.post(f'{self.URL}{app_id}/comply/', {'doc_valid_id': png('new.png')}, format='multipart')
        self.assertEqual(r.status_code, 400)

    def test_only_admins_review_and_only_the_owner_and_admins_open_the_id(self):
        app_id = self.apply().data['id']
        doc_id = ScholarshipApplication.objects.get(pk=app_id).documents.get().pk
        review = f'{self.URL}{app_id}/documents/{doc_id}/review/'
        file_url = f'{self.URL}{app_id}/documents/{doc_id}/'
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.post(review, {'status': 'verified'}, format='json').status_code, 403)
        self.assertEqual(self.client.get(file_url).status_code, 200)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(file_url).status_code, 404)
        self.client.force_authenticate(None)
        self.assertIn(self.client.get(file_url).status_code, (401, 403))
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.get(file_url).status_code, 200)
        self.assertNotIn('/media/', self.client.get(f'{self.URL}{app_id}/').data['documents'][0]['url'])

    def test_a_scholarship_without_a_valid_id_requirement_asks_for_nothing(self):
        self.sch.required_documents = []
        self.sch.save()
        self.assertEqual(self.apply(doc_valid_id=None, id_confirmed=None).status_code, 201)
