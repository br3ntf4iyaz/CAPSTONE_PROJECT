from django.contrib.auth import get_user_model
from django.core import mail
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.ledger.models import Anchor
from apps.notifications.models import Notification

from .models import YouthOrganization

User = get_user_model()


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
class YORPDecisionActionTests(TestCase):
    def setUp(self):
        self.leader = User.objects.create_user(email='lead@x.com', password='p', first_name='Lea', last_name='Der')
        self.admin = User.objects.create_user(email='adm@x.com', password='p', first_name='Ad', last_name='Min', role='lgu_admin')
        self.org = YouthOrganization.objects.create(
            name='Lucena Youth Council', classification='community_based', sub_classification='youth_org',
            submitted_by=self.leader, contact_email='council@x.com', is_active=False, status='pending')
        self.api = APIClient()

    def act(self, action, data=None, user=None):
        self.api.force_authenticate(user or self.admin)
        return self.api.post(f'/api/youth-orgs/{self.org.pk}/{action}/', data or {}, format='json')

    def test_approve_activates_and_lists_the_org_publicly(self):
        self.api.force_authenticate(None)
        before = self.api.get('/api/youth-orgs/').data
        before = before['results'] if isinstance(before, dict) else before
        self.assertNotIn('Lucena Youth Council', [o['name'] for o in before])

        r = self.act('approve', {'admin_notes': 'Complete documents.'})
        self.assertEqual(r.status_code, 200)
        self.org.refresh_from_db()
        self.assertEqual((self.org.status, self.org.is_active, self.org.registration_category), ('approved', True, 'lydo'))
        self.assertEqual(self.org.admin_notes, 'Complete documents.')

        self.api.force_authenticate(None)
        data = self.api.get('/api/youth-orgs/').data
        rows = data['results'] if isinstance(data, dict) else data
        self.assertIn('Lucena Youth Council', [o['name'] for o in rows])

    def test_submitter_is_notified_in_app_and_by_email(self):
        self.act('approve')
        n = Notification.objects.get(user=self.leader)
        self.assertIn('approved', n.title.lower())
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['council@x.com'])

    def test_reject_needs_a_reason_and_keeps_the_org_inactive(self):
        self.assertEqual(self.act('reject', {}).status_code, 400)
        self.assertEqual(self.act('reject', {'admin_notes': '   '}).status_code, 400)
        self.org.refresh_from_db()
        self.assertEqual(self.org.status, 'pending')

        r = self.act('reject', {'admin_notes': 'Roster has fewer than 10 members.'})
        self.assertEqual(r.status_code, 200)
        self.org.refresh_from_db()
        self.assertEqual((self.org.status, self.org.is_active), ('rejected', False))
        self.assertIn('fewer than 10', mail.outbox[0].body)

    def test_decision_is_fingerprinted_on_the_ledger_and_verifies(self):
        with self.captureOnCommitCallbacks(execute=True):
            self.act('approve')
        self.assertEqual(Anchor.objects.get(kind='yorp_decision', ref=str(self.org.pk)).status, 'anchored')
        self.api.force_authenticate(self.admin)
        res = self.api.get('/api/ledger/yorp-decisions/').data['results'][str(self.org.pk)]
        self.assertEqual(res['status'], 'verified')

    def test_changing_the_decision_records_a_new_fingerprint(self):
        with self.captureOnCommitCallbacks(execute=True):
            self.act('reject', {'admin_notes': 'Missing roster.'})
            self.act('approve', {'admin_notes': 'Roster received.'})
        self.assertEqual(Anchor.objects.filter(kind='yorp_decision').count(), 2)

    def test_invalid_registration_category_is_refused(self):
        self.assertEqual(self.act('approve', {'registration_category': 'bogus'}).status_code, 400)
        self.org.refresh_from_db()
        self.assertEqual(self.org.status, 'pending')

    def test_only_admins_can_decide(self):
        for action in ('approve', 'reject'):
            self.assertEqual(self.act(action, {'admin_notes': 'x'}, user=self.leader).status_code, 403)
        self.api.force_authenticate(None)
        self.assertIn(self.api.post(f'/api/youth-orgs/{self.org.pk}/approve/', {}, format='json').status_code, (401, 403))
        self.org.refresh_from_db()
        self.assertEqual(self.org.status, 'pending')

    def test_owner_sees_the_decision_and_notes_in_my_submissions(self):
        self.act('reject', {'admin_notes': 'Please resubmit the roster.'})
        self.api.force_authenticate(self.leader)
        row = self.api.get('/api/youth-orgs/my-submissions/').data[0]
        self.assertEqual((row['status'], row['admin_notes']), ('rejected', 'Please resubmit the roster.'))

    def test_admin_list_exposes_status_so_pending_can_be_filtered(self):
        self.api.force_authenticate(self.admin)
        data = self.api.get('/api/youth-orgs/').data
        rows = data['results'] if isinstance(data, dict) else data
        self.assertEqual(next(o for o in rows if o['id'] == self.org.pk)['status'], 'pending')


class YORPListNotTruncatedTests(TestCase):
    def test_admin_list_returns_every_organization_not_just_the_first_page(self):
        admin = User.objects.create_user(email='adm2@x.com', password='p', first_name='Ad', last_name='Min', role='lgu_admin')
        for i in range(25):
            YouthOrganization.objects.create(
                name=f'Org {i:02d}', classification='community_based', sub_classification='youth_org',
                is_active=bool(i % 2), status='approved' if i % 2 else 'pending')
        api = APIClient()
        api.force_authenticate(admin)
        data = api.get('/api/youth-orgs/').data
        rows = data['results'] if isinstance(data, dict) else data
        self.assertEqual(len(rows), 25)
