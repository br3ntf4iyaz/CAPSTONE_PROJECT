import io
import json
import shutil
import tempfile

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone
from datetime import timedelta
from PIL import Image
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.notifications.models import Notification
from apps.resources.models import Scholarship

from .models import ScholarshipApplication

TMP = tempfile.mkdtemp()

PERSONAL = {'full_name': 'Juan Dela Cruz', 'date_of_birth': '2005-03-02', 'age': '20', 'gender': 'Male', 'civil_status': 'Single',
            'nationality': 'Filipino', 'email': 'juan@example.com', 'contact_number': '09171234567',
            'address': '123 Rizal St', 'barangay': 'Barangay 1'}
EDUCATION = {'level': 'College', 'school_name': 'MPSPC', 'school_address': 'Lucena City', 'course': 'BSIT', 'year_level': '3rd year', 'gwa': '1.75'}
FAMILY = {'father_name': 'Pedro Dela Cruz', 'mother_name': 'Ana Dela Cruz', 'parent_occupation': 'Driver', 'monthly_income': '15000', 'family_members': '5'}


def png(name='x.png'):
    buf = io.BytesIO()
    Image.new('RGB', (20, 20), 'red').save(buf, 'PNG')
    return SimpleUploadedFile(name, buf.getvalue(), content_type='image/png')


@override_settings(PRIVATE_MEDIA_ROOT=TMP, MEDIA_ROOT=TMP)
class ScholarshipApplicationTests(APITestCase):
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
        self.sch = Scholarship.objects.create(
            title='Test Grant', provider='P', provider_type='government', coverage='c', amount='a', slots='s',
            required_documents=['valid_id', 'grades'], optional_documents=['other'], requires_gwa=True)

    def payload(self, **over):
        data = {'scholarship': self.sch.id, 'personal': json.dumps(PERSONAL), 'education': json.dumps(EDUCATION),
                'family': json.dumps(FAMILY), 'consent_given': 'true', 'doc_valid_id': png('id.png'), 'doc_grades': png('g.png')}
        data.update(over)
        return {k: v for k, v in data.items() if v is not None}

    def apply(self, **over):
        self.client.force_authenticate(self.user)
        return self.client.post(self.URL, self.payload(**over), format='multipart')

    def test_submit_creates_application_reference_documents_notification(self):
        r = self.apply()
        self.assertEqual(r.status_code, 201, r.data)
        self.assertTrue(r.data['reference_number'].startswith('SCH-'))
        self.assertEqual(len(r.data['documents']), 2)
        self.assertTrue(Notification.objects.filter(user=self.user).exists())

    def test_missing_required_document_rejected(self):
        r = self.apply(doc_grades=None)
        self.assertEqual(r.status_code, 400)
        self.assertFalse(ScholarshipApplication.objects.exists())

    def test_missing_field_and_consent_rejected(self):
        bad = dict(PERSONAL, full_name='')
        self.assertEqual(self.apply(personal=json.dumps(bad)).status_code, 400)
        self.assertEqual(self.apply(consent_given='false').status_code, 400)

    def test_gwa_required_when_scholarship_asks(self):
        self.assertEqual(self.apply(education=json.dumps({**EDUCATION, 'gwa': ''})).status_code, 400)

    def test_duplicate_blocked(self):
        self.assertEqual(self.apply().status_code, 201)
        self.assertEqual(self.apply(doc_valid_id=png('a.png'), doc_grades=png('b.png')).status_code, 400)

    def test_closed_scholarship_blocked(self):
        self.sch.closes_on = timezone.localdate() - timedelta(days=1)
        self.sch.save()
        self.assertEqual(self.apply().status_code, 400)

    def test_bad_file_type_rejected(self):
        evil = SimpleUploadedFile('x.pdf', b'not a pdf at all', content_type='application/pdf')
        self.assertEqual(self.apply(doc_valid_id=evil).status_code, 400)

    def test_document_not_in_scholarship_rejected(self):
        self.assertEqual(self.apply(doc_birth_certificate=png('b.png')).status_code, 400)

    def test_applicants_only_see_their_own(self):
        app_id = self.apply().data['id']
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(self.URL).data, [])
        self.assertEqual(self.client.get(f'{self.URL}{app_id}/').status_code, 404)
        doc_id = ScholarshipApplication.objects.get(pk=app_id).documents.first().pk
        self.assertEqual(self.client.get(f'{self.URL}{app_id}/documents/{doc_id}/').status_code, 404)
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.get(f'{self.URL}{app_id}/documents/{doc_id}/').status_code, 200)
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.get(f'{self.URL}{app_id}/documents/{doc_id}/').status_code, 200)

    def test_only_admin_can_review_and_applicant_is_notified(self):
        app_id = self.apply().data['id']
        r = self.client.patch(f'{self.URL}{app_id}/review/', {'status': 'approved'}, format='json')
        self.assertEqual(r.status_code, 403)
        self.client.force_authenticate(self.admin)
        r = self.client.patch(f'{self.URL}{app_id}/review/', {'status': 'approved', 'admin_remarks': 'Congrats'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertTrue(Notification.objects.filter(user=self.user, title__icontains='approved').exists())

    def test_compliance_requires_remarks_then_applicant_complies(self):
        app_id = self.apply().data['id']
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.patch(f'{self.URL}{app_id}/review/', {'status': 'for_compliance'}, format='json').status_code, 400)
        self.client.patch(f'{self.URL}{app_id}/review/', {'status': 'for_compliance', 'admin_remarks': 'Blurry ID'}, format='json')
        self.client.force_authenticate(self.user)
        r = self.client.post(f'{self.URL}{app_id}/comply/', {'doc_valid_id': png('new.png'), 'message': 'Sent'}, format='multipart')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data['status'], 'under_review')
        self.assertEqual(len(r.data['documents']), 3)

    def test_comply_only_when_asked(self):
        app_id = self.apply().data['id']
        r = self.client.post(f'{self.URL}{app_id}/comply/', {'message': 'x'}, format='multipart')
        self.assertEqual(r.status_code, 400)

    def test_withdraw_only_by_owner(self):
        app_id = self.apply().data['id']
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.post(f'{self.URL}{app_id}/withdraw/').status_code, 404)
        self.client.force_authenticate(self.user)
        r = self.client.post(f'{self.URL}{app_id}/withdraw/')
        self.assertEqual(r.data['status'], 'withdrawn')

    def test_old_endpoint_no_longer_takes_scholarships(self):
        self.client.force_authenticate(self.user)
        r = self.client.post('/api/applications/', {
            'kind': 'scholarship', 'object_id': self.sch.id, 'full_name': 'A', 'contact_number': '0917', 'email': 'a@x.com', 'address': 'x'})
        self.assertEqual(r.status_code, 400)

    def test_scholarship_list_reports_state_and_documents(self):
        r = self.client.get('/api/scholarships/')
        item = r.data['results'][0] if isinstance(r.data, dict) else r.data[0]
        self.assertEqual(item['application_status'], 'open')
        self.assertEqual([d['key'] for d in item['document_requirements']], ['valid_id', 'grades', 'other'])
