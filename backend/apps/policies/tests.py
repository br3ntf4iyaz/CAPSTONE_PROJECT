from rest_framework.test import APITestCase

from apps.accounts.models import User


class PolicyTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(email='pa@x.com', password='p', role='lgu_admin', is_active=True)
        self.youth = User.objects.create_user(email='py@x.com', password='p', role='youth', is_active=True)

    def test_policies_are_public_and_start_as_unreviewed_drafts(self):
        r = self.client.get('/api/policies/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual([p['slug'] for p in r.data], ['terms', 'privacy', 'cookies'])
        for slug in ('terms', 'privacy', 'cookies'):
            d = self.client.get(f'/api/policies/{slug}/').data
            self.assertTrue(d['content'].strip())
            self.assertTrue(d['needs_review'])  # nothing is presented as reviewed until an administrator says so
            self.assertEqual(d['version'], 1)
        self.assertEqual(self.client.get('/api/policies/nope/').status_code, 404)
        # the draft text must not claim legal compliance
        text = ' '.join(self.client.get(f'/api/policies/{s}/').data['content'].lower() for s in ('terms', 'privacy', 'cookies'))
        self.assertNotIn('fully compliant', text)
        self.assertNotIn('guarantee', text.replace('does not guarantee', ''))

    def test_only_administrators_can_edit_and_each_edit_keeps_the_old_version(self):
        self.assertEqual(self.client.patch('/api/policies/terms/', {'content': 'x'}, format='json').status_code, 401)
        self.client.force_authenticate(self.youth)
        self.assertEqual(self.client.patch('/api/policies/terms/', {'content': 'x'}, format='json').status_code, 403)
        self.client.force_authenticate(self.admin)
        r = self.client.patch('/api/policies/terms/', {'content': '## New\nChanged text.', 'reviewed': True}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data['version'], 2)
        # changing the wording means it needs review again, even if the request said reviewed
        r2 = self.client.patch('/api/policies/terms/', {'reviewed': True}, format='json')
        self.assertFalse(r2.data['needs_review'])
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get('/api/policies/terms/').data['content'], '## New\nChanged text.')
        self.client.force_authenticate(self.admin)
        revs = self.client.get('/api/policies/terms/revisions/').data
        self.assertEqual([x['version'] for x in revs], [2, 1])
        self.client.force_authenticate(self.youth)
        self.assertEqual(self.client.get('/api/policies/terms/revisions/').status_code, 403)


class RegistrationAcknowledgementTests(APITestCase):
    BASE = {'first_name': 'Ana', 'last_name': 'Reyes', 'role': 'youth', 'password': 'Str0ng!Passw0rd', 'password2': 'Str0ng!Passw0rd'}

    def test_registration_needs_an_active_acknowledgement(self):
        r = self.client.post('/api/auth/register/', {**self.BASE, 'email': 'a1@x.com'}, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertIn('accepted_terms', r.data)
        r = self.client.post('/api/auth/register/', {**self.BASE, 'email': 'a1@x.com', 'accepted_terms': False}, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertFalse(User.objects.filter(email='a1@x.com').exists())
        r = self.client.post('/api/auth/register/', {**self.BASE, 'email': 'a1@x.com', 'accepted_terms': True}, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        user = User.objects.get(email='a1@x.com')
        self.assertIsNotNone(user.policies_accepted_at)
        self.assertIn('terms:1', user.policies_version)
