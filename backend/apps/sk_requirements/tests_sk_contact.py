from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import AuditLog
from apps.verification.models import IDVerification
from .models import SKBarangay

User = get_user_model()


class SKContactTests(TestCase):
    def setUp(self):
        self.a = SKBarangay.objects.create(barangay_name='Barangay A', sk_chairperson='Chair A', contact_email='old@x.ph', contact_phone='09170000000')
        self.b = SKBarangay.objects.create(barangay_name='Barangay B', sk_chairperson='Chair B')
        self.admin = User.objects.create_user(email='adm@t.local', password='x', role='lgu_admin', is_active=True)
        self.sk = User.objects.create_user(email='sk@t.local', password='x', role='youth', youth_type='sk', is_active=True)
        self.sk.profile.barangay = 'Barangay A'
        self.sk.profile.save()
        self.other = User.objects.create_user(email='o@t.local', password='x', role='youth', youth_type='sk', is_active=True)
        self.other.profile.barangay = 'Barangay B'
        self.other.profile.save()
        self.general = User.objects.create_user(email='g@t.local', password='x', role='youth', is_active=True)
        self.url = f'/api/sk-requirements/barangays/{self.a.id}/contact/'

    def verify(self, user):
        IDVerification.objects.update_or_create(user=user, defaults={'status': 'approved'})

    def post(self, user, data):
        c = APIClient()
        c.force_authenticate(user)
        return c.post(self.url, data, format='json')

    def test_a_verified_sk_of_the_barangay_changes_email_and_phone(self):
        self.verify(self.sk)
        r = self.post(self.sk, {'contact_email': 'sk.new@lucena.gov.ph', 'contact_phone': '0917 123 4567'})
        self.assertEqual(r.status_code, 200)
        self.a.refresh_from_db()
        self.assertEqual((self.a.contact_email, self.a.contact_phone), ('sk.new@lucena.gov.ph', '+63 917 123 4567'))
        self.assertTrue(AuditLog.objects.filter(action='sk_contact_changed', object_id=self.a.pk).exists())

    def test_an_unverified_sk_must_verify_first(self):
        r = self.post(self.sk, {'contact_email': 'x@y.ph'})
        self.assertEqual(r.status_code, 403)
        self.a.refresh_from_db()
        self.assertEqual(self.a.contact_email, 'old@x.ph')

    def test_other_barangays_sk_and_general_youth_are_refused(self):
        self.verify(self.other)
        for u in (self.other, self.general):
            self.assertEqual(self.post(u, {'contact_email': 'x@y.ph'}).status_code, 403)
        self.assertEqual(APIClient().post(self.url, {'contact_email': 'x@y.ph'}, format='json').status_code, 401)
        self.a.refresh_from_db()
        self.assertEqual(self.a.contact_email, 'old@x.ph')

    def test_lydo_admin_can_change_it(self):
        self.assertEqual(self.post(self.admin, {'contact_phone': '09181234567'}).status_code, 200)
        self.a.refresh_from_db()
        self.assertEqual(self.a.contact_phone, '+63 918 123 4567')
        self.assertEqual(self.a.contact_email, 'old@x.ph')  # only what was sent changes

    def test_bad_values_are_rejected_and_blank_clears(self):
        self.verify(self.sk)
        self.assertEqual(self.post(self.sk, {'contact_email': 'not-an-email'}).status_code, 400)
        self.assertEqual(self.post(self.sk, {'contact_phone': 'call me <script>'}).status_code, 400)
        self.assertEqual(self.post(self.sk, {}).status_code, 400)
        self.a.refresh_from_db()
        self.assertEqual((self.a.contact_email, self.a.contact_phone), ('old@x.ph', '09170000000'))
        self.assertEqual(self.post(self.sk, {'contact_email': '', 'contact_phone': ''}).status_code, 200)
        self.a.refresh_from_db()
        self.assertEqual((self.a.contact_email, self.a.contact_phone), ('', ''))

    def test_philippine_numbers_are_accepted_and_written_the_same_way(self):
        from .views import normalize_ph_phone
        for raw in ('09171234567', '+639171234567', '+63 917 123 4567', '0917-123-4567', '63 917 123 4567'):
            self.assertEqual(normalize_ph_phone(raw), '+63 917 123 4567', raw)
        self.assertEqual(normalize_ph_phone('(042) 710 1234'), '(042) 710 1234')
        self.assertEqual(normalize_ph_phone('042-7101234'), '(042) 710 1234')
        self.assertEqual(normalize_ph_phone('+63 2 8123 4567'), '(02) 8123 4567')

    def test_numbers_from_other_countries_or_nonsense_are_refused(self):
        from .views import normalize_ph_phone
        for raw in ('+1 202 555 0143', '+44 20 7946 0958', '12345', '0917 123 45', 'call me', '+63 123', '0817abc4567'):
            self.assertIsNone(normalize_ph_phone(raw), raw)
        self.verify(self.sk)
        self.assertEqual(self.post(self.sk, {'contact_phone': '+1 202 555 0143'}).status_code, 400)
