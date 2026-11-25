import json
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


LIVE = {'cardDetected': True, 'uploaded': False}
FACE_OK = {'distance': 0.31, 'similarity': 0.69, 'matched': True, 'front': LIVE, 'back': LIVE, 'selfie': {'uploaded': False, 'liveness': True}}


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
                'address': 'Lucena', 'id_type': 'UMID', 'id_number': '1234', 'id_document': png('front.png'),
                'id_document_back': png('back.png'), 'selfie': png('selfie.png'), 'document': pdf(),
                'face_check': json.dumps(FACE_OK)}
        data.update(over)
        return {k: v for k, v in data.items() if v is not None}

    def apply(self, **over):
        self.client.force_authenticate(self.user)
        return self.client.post('/api/applications/', self.payload(**over), format='multipart')

    def test_a_complete_application_is_saved_with_both_sides_of_the_id_the_selfie_and_the_resume(self):
        r = self.apply()
        self.assertEqual(r.status_code, 201, r.data)
        for key in ('id_document_url', 'id_document_back_url', 'selfie_url', 'document_url'):
            self.assertTrue(r.data[key], key)
        self.assertNotIn('face_check', r.data)  # the applicant's device measurement is for the administrator only

    def test_everything_is_required(self):
        for field in ('id_document', 'id_document_back', 'selfie', 'document', 'id_number', 'id_type'):
            cache.clear()
            r = self.apply(**{field: None})
            self.assertEqual(r.status_code, 400, field)
            self.assertIn(field, r.data, field)

    def test_a_photo_taken_from_the_gallery_is_refused(self):
        gallery = dict(FACE_OK, front={'uploaded': True})
        r = self.apply(face_check=json.dumps(gallery))
        self.assertEqual(r.status_code, 400)

    def test_a_face_that_does_not_match_is_refused(self):
        r = self.apply(face_check=json.dumps(dict(FACE_OK, matched=False, distance=0.9)))
        self.assertEqual(r.status_code, 400)
        self.assertIn('selfie', r.data)

    def test_a_wrong_kind_of_file_is_refused(self):
        bad = SimpleUploadedFile('id.exe', b'MZ', content_type='application/octet-stream')
        self.assertEqual(self.apply(id_document=bad).status_code, 400)
        self.assertEqual(self.apply(id_document=pdf('id.pdf')).status_code, 400)  # the ID must be a photo taken by the camera

    def test_only_the_owner_and_admins_can_open_the_files(self):
        app_id = self.apply().data['id']
        for part in ('id-document', 'id-document-back', 'selfie', 'document'):
            url = f'/api/applications/{app_id}/{part}/'
            self.client.force_authenticate(None)
            self.assertEqual(self.client.get(url).status_code, 401, part)
            self.client.force_authenticate(self.other)
            self.assertEqual(self.client.get(url).status_code, 404, part)
            self.client.force_authenticate(self.user)
            self.assertEqual(self.client.get(url).status_code, 200, part)
            self.client.force_authenticate(self.admin)
            self.assertEqual(self.client.get(url).status_code, 200, part)

    def test_an_application_cannot_be_approved_blindly(self):
        app_id = self.apply().data['id']
        url = f'/api/applications/{app_id}/'
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.patch(url, {'status': 'approved'}, format='json').status_code, 400)  # not under review
        self.assertEqual(self.client.patch(url, {'status': 'under_review'}, format='json').status_code, 200)
        r = self.client.patch(url, {'status': 'approved'}, format='json')  # nothing opened, nothing ticked
        self.assertEqual(r.status_code, 400)
        self.assertTrue(r.data['blockers'])

    def refuse(self, app_id, note='The back of the ID is not readable'):
        self.client.force_authenticate(self.admin)
        url = f'/api/applications/{app_id}/'
        self.client.patch(url, {'status': 'under_review'}, format='json')
        return self.client.patch(url, {'status': 'rejected', 'admin_note': note}, format='json')

    def test_a_refusal_with_a_reason_works_and_a_note_alone_can_be_edited_later(self):
        app_id = self.apply().data['id']
        self.assertEqual(self.refuse(app_id).status_code, 200)
        again = self.client.patch(f'/api/applications/{app_id}/', {'admin_note': 'The back of the ID is not readable. You may send it again.'}, format='json')
        self.assertEqual(again.status_code, 200)

    def test_after_a_refusal_the_applicant_can_send_it_again_with_new_photos(self):
        app_id = self.apply().data['id']
        self.refuse(app_id)
        self.client.force_authenticate(self.user)
        # the resume already on file may be kept
        r = self.client.post(f'/api/applications/{app_id}/resubmit/', self.payload(document=None, id_number='9999'), format='multipart')
        self.assertEqual(r.status_code, 200, r.data)
        app = OpportunityApplication.objects.get(pk=app_id)
        self.assertEqual(app.status, 'submitted')
        self.assertEqual(app.resubmit_count, 1)
        self.assertEqual(app.previous_note, 'The back of the ID is not readable')
        self.assertEqual(app.admin_note, '')
        self.assertEqual(app.id_number, '9999')
        self.assertTrue(app.document)  # the earlier resume was kept
        self.assertEqual(OpportunityApplication.objects.filter(applicant=self.user).count(), 1)  # same application, not a new one

    def test_resubmit_is_only_for_a_refused_application_of_your_own_and_needs_the_same_proof(self):
        app_id = self.apply().data['id']
        self.client.force_authenticate(self.user)
        url = f'/api/applications/{app_id}/resubmit/'
        self.assertEqual(self.client.post(url, self.payload(), format='multipart').status_code, 400)  # not refused yet
        self.refuse(app_id)
        self.client.force_authenticate(self.other)
        self.assertIn(self.client.post(url, self.payload(), format='multipart').status_code, (403, 404))  # not yours
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.post(url, self.payload(selfie=None), format='multipart').status_code, 400)  # still needs a selfie
        self.assertEqual(self.client.post(url, self.payload(face_check=json.dumps(dict(FACE_OK, matched=False))), format='multipart').status_code, 400)

    def test_a_resubmitted_application_goes_through_the_review_again(self):
        app_id = self.apply().data['id']
        self.refuse(app_id)
        self.client.force_authenticate(self.user)
        self.client.post(f'/api/applications/{app_id}/resubmit/', self.payload(), format='multipart')
        self.client.force_authenticate(self.admin)
        url = f'/api/applications/{app_id}/'
        self.assertEqual(self.client.patch(url, {'status': 'approved'}, format='json').status_code, 400)
