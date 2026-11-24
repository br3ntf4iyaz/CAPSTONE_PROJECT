from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.accounts.verification import id_status, is_id_verified
from apps.schools.models import Program, School, SchoolProgram
from apps.verification.models import IDVerification


class VerifyGateTests(APITestCase):
    """Applying needs an approved identity. Browsing, and the courses of the schools for anyone signed in, do not."""

    def setUp(self):
        self.user = User.objects.create_user(email='v@x.com', password='p', role='youth', is_active=True)
        self.admin = User.objects.create_user(email='ad@x.com', password='p', role='lgu_admin', is_active=True)
        self.school = School.objects.create(name='S', school_type='private', address='x', municipality='Lucena City', province='Quezon', region='IV-A')
        prog = Program.objects.create(name='BS Gate Course', program_type='bachelor')
        SchoolProgram.objects.create(school=self.school, program=prog, verification_status='verified', is_active=True)

    def set_status(self, status):
        IDVerification.objects.update_or_create(user=self.user, defaults={'id_type': 'umid', 'status': status})

    def post_scholarship(self):
        self.client.force_authenticate(self.user)
        return self.client.post('/api/applications/scholarship/', {}, format='multipart')

    def test_helpers(self):
        self.assertEqual(id_status(self.user), 'none')
        self.assertFalse(is_id_verified(self.user))
        self.set_status('approved')
        self.user.refresh_from_db()
        self.assertTrue(is_id_verified(User.objects.get(pk=self.user.pk)))
        self.assertTrue(is_id_verified(self.admin))

    def test_unverified_cannot_apply_anywhere(self):
        self.client.force_authenticate(self.user)
        for url in ('/api/applications/', '/api/applications/scholarship/', '/api/internships/applications/'):
            r = self.client.post(url, {}, format='json')
            self.assertEqual(r.status_code, 403, url)
            self.assertEqual(r.data['code'], 'verify_first', url)

    def test_pending_reviewing_rejected_are_blocked_with_status(self):
        for st in ('pending', 'reviewing', 'rejected'):
            self.set_status(st)
            self.user = User.objects.get(pk=self.user.pk)
            r = self.post_scholarship()
            self.assertEqual(r.status_code, 403, st)
            self.assertEqual(r.data['code'], 'verify_first')
            self.assertEqual(r.data['verification_status'], st)

    def test_approved_passes_the_gate(self):
        self.set_status('approved')
        r = self.post_scholarship()
        self.assertNotEqual(r.status_code, 403)  # now it is the form that is checked, not the account

    def test_me_reports_verification(self):
        self.client.force_authenticate(self.user)
        me = self.client.get('/api/auth/me/')
        self.assertEqual(me.data['id_verification_status'], 'none')
        self.assertFalse(me.data['id_verified'])
        self.set_status('approved')
        self.client.force_authenticate(User.objects.get(pk=self.user.pk))
        self.assertTrue(self.client.get('/api/auth/me/').data['id_verified'])

    def test_courses_need_only_sign_in_not_verification(self):
        self.client.force_authenticate(self.user)  # never verified
        d = self.client.get(f'/api/schools/{self.school.id}/')
        self.assertFalse(d.data['courses_locked'])
        self.assertEqual([p['program']['name'] for p in d.data['programs']], ['BS Gate Course'])
        self.assertEqual(self.client.get('/api/schools/courses/').status_code, 200)

    def test_listing_own_applications_is_not_blocked(self):
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.get('/api/applications/').status_code, 200)
        self.assertEqual(self.client.get('/api/applications/scholarship/').status_code, 200)
