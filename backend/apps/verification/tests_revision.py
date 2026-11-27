from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import AuditLog
from apps.accounts.verification import IsIDVerified, id_status
from apps.notifications.models import Notification

from .models import IDVerification

User = get_user_model()


class VerificationLifecycleTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(email='ad@t.local', password='x', role='lgu_admin', is_active=True)
        self.person = User.objects.create_user(email='p@t.local', password='x', role='youth', is_active=True)
        self.v = IDVerification.objects.create(user=self.person, id_type='national_id', status='reviewing')
        self.ac, self.pc = APIClient(), APIClient()
        self.ac.force_authenticate(self.admin)
        self.pc.force_authenticate(self.person)
        self.url = f'/api/verification/admin/{self.v.pk}/'

    def patch(self, status, note=''):
        return self.ac.patch(self.url, {'status': status, 'admin_notes': note}, format='json')

    def test_reference_number_and_history_start_blank_and_grow(self):
        self.assertEqual(self.v.reference_number, f'LYD-V-{self.v.pk:06d}')
        self.assertEqual(self.patch('revision', 'Photo of the ID is blurry').status_code, 200)
        self.assertEqual(self.patch('approved').status_code, 200)
        data = self.pc.get('/api/verification/').data
        self.assertEqual(data['reference_number'], self.v.reference_number)
        self.assertEqual([e['action'] for e in data['history']], ['revision', 'approved'])
        self.assertEqual(data['history'][0]['note'], 'Photo of the ID is blurry')

    def test_revision_needs_a_note_and_tells_the_person(self):
        self.assertEqual(self.patch('revision').status_code, 400)
        self.assertEqual(self.patch('revision', 'Please upload a clearer front photo').status_code, 200)
        self.v.refresh_from_db()
        self.assertEqual(self.v.status, 'revision')
        self.assertTrue(Notification.objects.filter(user=self.person, title='Revision required').exists())
        self.assertEqual(id_status(self.person), 'revision')

    def test_revision_rejected_and_suspended_people_are_blocked_from_applying(self):
        for status in ('revision', 'rejected', 'suspended'):
            IDVerification.objects.filter(pk=self.v.pk).update(status=status)
            self.person.refresh_from_db()
            req = type('R', (), {'user': User.objects.get(pk=self.person.pk)})()
            from rest_framework.exceptions import PermissionDenied
            with self.assertRaises(PermissionDenied) as ctx:
                IsIDVerified().has_permission(req, None)
            self.assertEqual(ctx.exception.detail['code'], 'verify_first')
            self.assertEqual(ctx.exception.detail['verification_status'], status)

    def test_suspend_restore_and_reject_rules(self):
        self.assertEqual(self.patch('suspended', 'Misuse reported to LYDO').status_code, 400)  # only a verified account can be suspended
        self.patch('approved')
        self.assertEqual(self.patch('suspended').status_code, 400)  # a reason is needed
        self.assertEqual(self.patch('suspended', 'Misuse reported to LYDO').status_code, 200)
        self.assertEqual(self.patch('revision', 'try this').status_code, 400)  # a suspended account is restored or rejected only
        r = self.patch('approved')
        self.assertEqual(r.status_code, 200)
        self.assertEqual([e['action'] for e in r.data['history']], ['approved', 'suspended', 'restored'])
        self.assertTrue(AuditLog.objects.filter(action='verification_suspended').exists())
        self.assertTrue(AuditLog.objects.filter(action='verification_restored').exists())
        self.assertTrue(Notification.objects.filter(user=self.person, title='Account suspended').exists())

    def test_a_suspended_person_cannot_resubmit_to_clear_it(self):
        IDVerification.objects.filter(pk=self.v.pk).update(status='suspended')
        r = self.pc.post('/api/verification/submit/', {'consent': 'true', 'id_type': 'national_id'})
        self.assertEqual(r.status_code, 403)
        self.assertEqual(IDVerification.objects.get(pk=self.v.pk).status, 'suspended')

    def test_only_admins_decide_and_view_the_documents(self):
        self.assertEqual(self.pc.patch(self.url, {'status': 'approved'}, format='json').status_code, 403)
        self.v.residency_doc.save('cert.pdf', SimpleUploadedFile('cert.pdf', b'%PDF-1.4 x'), save=True)
        self.assertEqual(self.pc.get(f'{self.url}file/residency_doc/').status_code, 403)
        self.assertEqual(self.ac.get(f'{self.url}file/residency_doc/').status_code, 200)
        row = [r for r in self.ac.get('/api/verification/admin/').data if r['id'] == self.v.pk][0]
        self.assertTrue(row['has_residency_doc'])
        self.assertIn('/file/residency_doc/', row['residency_doc_url'])
        self.assertEqual(row['applicant']['email'], 'p@t.local')
