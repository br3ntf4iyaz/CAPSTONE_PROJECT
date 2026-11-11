from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

User = get_user_model()

REGISTER = {
    'first_name': 'Juan', 'last_name': 'Cruz', 'role': 'youth',
    'password': 'Str0ng!Passw0rd', 'password2': 'Str0ng!Passw0rd',
}


class EmailCaseTests(TestCase):
    def setUp(self):
        self.api = APIClient()

    def register(self, email):
        return self.api.post('/api/auth/register/', {**REGISTER, 'email': email}, format='json')

    def login(self, email, password='Str0ng!Passw0rd'):
        return self.api.post('/api/auth/login/', {'email': email, 'password': password}, format='json')

    def verify(self, email):
        User.objects.filter(email__iexact=email).update(is_email_verified=True)

    def test_email_is_stored_lowercase(self):
        self.assertEqual(self.register('Juan.Cruz@Gmail.com').status_code, 201)
        self.assertTrue(User.objects.filter(email='juan.cruz@gmail.com').exists())

    def test_login_works_with_any_capitalisation(self):
        self.register('juan@example.com')
        self.verify('juan@example.com')
        for typed in ('juan@example.com', 'Juan@example.com', 'JUAN@EXAMPLE.COM', '  juan@example.com '):
            r = self.login(typed)
            self.assertEqual(r.status_code, 200, typed)
            self.assertIn('access', r.data)

    def test_old_mixed_case_account_can_still_log_in(self):
        # Accounts created before this fix may be stored with capitals.
        User.objects.create_user(email='Ana@Example.com', password='Str0ng!Passw0rd',
                                 first_name='Ana', last_name='R', is_email_verified=True)
        for typed in ('Ana@Example.com', 'ana@example.com'):
            self.assertEqual(self.login(typed).status_code, 200, typed)

    def test_unverified_user_is_told_to_verify(self):
        self.register('juan@example.com')
        r = self.login('JUAN@example.com')
        self.assertEqual(r.status_code, 403)
        self.assertEqual(r.data['code'], 'email_not_verified')

    def test_wrong_password_and_unknown_email_are_401(self):
        self.register('juan@example.com')
        self.verify('juan@example.com')
        self.assertEqual(self.login('juan@example.com', 'nope').status_code, 401)
        self.assertEqual(self.login('ghost@example.com').status_code, 401)

    def test_case_variant_of_verified_email_cannot_register_again(self):
        self.register('juan@example.com')
        self.verify('juan@example.com')
        self.assertEqual(self.register('JUAN@example.com').status_code, 400)

    def test_reregistering_unverified_email_with_other_case_resends_instead_of_failing(self):
        self.register('juan@example.com')
        r = self.register('Juan@Example.com')
        self.assertEqual(r.status_code, 201)
        self.assertEqual(User.objects.count(), 1)
