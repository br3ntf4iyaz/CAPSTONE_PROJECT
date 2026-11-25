from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from .models import AuditLog

User = get_user_model()


class YouthTypeChangeTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(email='ad@t.local', password='x', role='lgu_admin', is_active=True)
        self.youth = User.objects.create_user(email='y@t.local', password='x', role='youth', is_active=True)
        self.other = User.objects.create_user(email='o@t.local', password='x', role='youth', is_active=True)

    def test_an_admin_can_make_a_youth_account_an_sk_official_and_it_is_logged(self):
        c = APIClient()
        c.force_authenticate(self.admin)
        r = c.patch(f'/api/auth/admin/users/{self.youth.pk}/', {'youth_type': 'sk'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.youth.refresh_from_db()
        self.assertEqual((self.youth.youth_type, self.youth.email, self.youth.role), ('sk', 'y@t.local', 'youth'))
        log = AuditLog.objects.get(action='youth_type_changed')
        self.assertEqual((log.details['from'], log.details['to']), ('general_youth', 'sk'))

    def test_a_youth_cannot_change_anyones_type(self):
        c = APIClient()
        c.force_authenticate(self.other)
        r = c.patch(f'/api/auth/admin/users/{self.youth.pk}/', {'youth_type': 'sk'}, format='json')
        self.assertIn(r.status_code, (401, 403))
        self.youth.refresh_from_db()
        self.assertEqual(self.youth.youth_type, 'general_youth')
