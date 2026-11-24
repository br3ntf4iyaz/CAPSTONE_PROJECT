import shutil
import tempfile

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.jobs.models import JobOpportunity
from apps.notifications.models import Notification
from apps.verification.models import IDVerification

from .models import OpportunityApplication
from .tests_scholarship import png

TMP = tempfile.mkdtemp()


def pdf(name='cv.pdf'):
    return SimpleUploadedFile(name, b'%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF', content_type='application/pdf')


@override_settings(PRIVATE_MEDIA_ROOT=TMP, MEDIA_ROOT=TMP)
class JobApplicationTests(APITestCase):
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
        self.job = JobOpportunity.objects.create(title='Clerk', company_or_org='LGU', location='Lucena', job_type='full_time',
                                                 industry='other', description='d', is_active=True)

    def payload(self, **over):
        data = {'kind': 'job', 'object_id': self.job.id, 'full_name': 'Juan', 'contact_number': '0917', 'email': 'a@x.com',
                'address': 'Lucena', 'id_type': 'UMID', 'id_number': '1234', 'id_document': png('id.png'), 'document': pdf()}
        data.update(over)
        return {k: v for k, v in data.items() if v is not None}

    def apply(self, **over):
        self.client.force_authenticate(self.user)
        return self.client.post('/api/applications/', self.payload(**over), format='multipart')

    def test_a_complete_application_is_saved_with_the_id_and_the_resume(self):
        r = self.apply()
        self.assertEqual(r.status_code, 201, r.data)
        self.assertTrue(r.data['id_document_url'])
        self.assertTrue(r.data['document_url'])

    def test_the_id_photo_the_id_details_and_the_resume_are_all_required(self):
        for field in ('id_document', 'document', 'id_number', 'id_type'):
            cache.clear()
            r = self.apply(**{field: None})
            self.assertEqual(r.status_code, 400, field)
            self.assertIn(field, r.data, field)

    def test_a_wrong_kind_of_file_is_refused(self):
        bad = SimpleUploadedFile('id.exe', b'MZ', content_type='application/octet-stream')
        self.assertEqual(self.apply(id_document=bad).status_code, 400)

    def test_only_the_owner_and_admins_can_open_the_files(self):
        app_id = self.apply().data['id']
        url = f'/api/applications/{app_id}/id-document/'
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(url).status_code, 401)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(url).status_code, 404)
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.get(url).status_code, 200)
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.get(url).status_code, 200)
        self.assertEqual(self.client.get(f'/api/applications/{app_id}/document/').status_code, 200)

    def test_an_application_cannot_be_decided_blindly(self):
        app_id = self.apply().data['id']
        url = f'/api/applications/{app_id}/'
        self.client.force_authenticate(self.admin)
        # straight from Submitted: no
        r = self.client.patch(url, {'status': 'approved', 'documents_checked': True}, format='json')
        self.assertEqual(r.status_code, 400)
        # start the review
        self.assertEqual(self.client.patch(url, {'status': 'under_review'}, format='json').status_code, 200)
        # without confirming the documents were checked: no
        self.assertEqual(self.client.patch(url, {'status': 'approved'}, format='json').status_code, 400)
        # refusing needs a reason
        self.assertEqual(self.client.patch(url, {'status': 'rejected', 'documents_checked': True}, format='json').status_code, 400)
        # approving after checking: yes, and the applicant is told
        ok = self.client.patch(url, {'status': 'approved', 'documents_checked': True, 'admin_note': 'Welcome aboard'}, format='json')
        self.assertEqual(ok.status_code, 200, ok.data)
        self.assertTrue(Notification.objects.filter(user=self.user, title='Application approved').exists())
        self.assertEqual(OpportunityApplication.objects.get(pk=app_id).status, 'approved')

    def test_a_refusal_with_a_reason_works_and_a_note_alone_can_be_edited_later(self):
        app_id = self.apply().data['id']
        url = f'/api/applications/{app_id}/'
        self.client.force_authenticate(self.admin)
        self.client.patch(url, {'status': 'under_review'}, format='json')
        r = self.client.patch(url, {'status': 'rejected', 'documents_checked': True, 'admin_note': 'ID is not readable'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        again = self.client.patch(url, {'admin_note': 'ID is not readable. You may apply again.'}, format='json')
        self.assertEqual(again.status_code, 200)
