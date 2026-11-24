from rest_framework.test import APITestCase

from apps.accounts.models import User

from .models import YouthProgram


def make(title, published=True, submitter='youth_org', status='upcoming'):
    return YouthProgram.objects.create(
        title=title, category='education', status=status, submitter_type=submitter, description='About ' + title,
        objectives='Obj', target_beneficiaries='Out-of-school youth', is_published=published,
        contact_email='contact@example.org', contact_person='Pat')


class PublishedProgramsTests(APITestCase):
    def setUp(self):
        self.live = make('Live Program')
        self.draft = make('Draft Program', published=False)
        self.sk = make('SK Program', submitter='sk')
        self.cancelled = make('Cancelled Program', status='cancelled')
        self.admin = User.objects.create_user(email='pg@x.com', password='p', role='lgu_admin', is_active=True)

    def titles(self, data):
        return sorted(p['title'] for p in (data['results'] if isinstance(data, dict) else data))

    def test_visitors_never_see_drafts_in_any_public_endpoint(self):
        self.assertEqual(self.titles(self.client.get('/api/programs/').data), ['Cancelled Program', 'Live Program', 'SK Program'])
        self.assertEqual(self.client.get(f'/api/programs/{self.draft.id}/').status_code, 404)
        self.assertEqual(self.client.get(f'/api/programs/{self.live.id}/').status_code, 200)
        self.assertNotIn('Draft Program', self.titles(self.client.get('/api/programs/home/').data))

    def test_homepage_lists_published_youth_org_programs_without_sign_in(self):
        r = self.client.get('/api/programs/home/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.titles(r.data), ['Live Program'])  # not the draft, not the SK program, not the cancelled one
        item = r.data[0]
        for key in ('title', 'description', 'objectives', 'target_beneficiaries', 'start_date', 'end_date', 'location'):
            self.assertIn(key, item)
        self.assertNotIn('submitted_by_email', item)  # no account details on the public page

    def test_administrators_see_drafts_and_can_publish_and_unpublish(self):
        self.client.force_authenticate(self.admin)
        self.assertIn('Draft Program', self.titles(self.client.get('/api/programs/').data))
        r = self.client.patch(f'/api/programs/{self.draft.id}/', {'is_published': True}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.client.force_authenticate(None)
        self.assertIn('Draft Program', self.titles(self.client.get('/api/programs/home/').data))
        self.client.force_authenticate(self.admin)
        self.client.patch(f'/api/programs/{self.draft.id}/', {'is_published': False}, format='json')
        self.client.force_authenticate(None)
        self.assertNotIn('Draft Program', self.titles(self.client.get('/api/programs/home/').data))

    def test_ordinary_accounts_cannot_change_publication(self):
        youth = User.objects.create_user(email='py2@x.com', password='p', role='youth', is_active=True)
        self.client.force_authenticate(youth)
        self.assertEqual(self.client.patch(f'/api/programs/{self.live.id}/', {'is_published': False}, format='json').status_code, 403)
        self.live.refresh_from_db()
        self.assertTrue(self.live.is_published)
