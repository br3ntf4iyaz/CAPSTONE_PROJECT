from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.notifications.models import Notification

from .models import OrgAccomplishment, OrgMembershipApplication, OrgRequirement, YouthOrganization

User = get_user_model()


class PublicOrganizationTests(TestCase):
    def setUp(self):
        self.leader = User.objects.create_user(email='leader@t.local', password='x', role='youth', youth_type='youth_org_leader', is_active=True)
        self.youth = User.objects.create_user(email='y@t.local', password='x', role='youth', is_active=True)
        self.sk = User.objects.create_user(email='sk@t.local', password='x', role='youth', youth_type='sk', is_active=True)
        self.stranger = User.objects.create_user(email='s@t.local', password='x', role='youth', is_active=True)
        self.admin = User.objects.create_user(email='ad@t.local', password='x', role='lgu_admin', is_active=True)

        def mk(name, **kw):
            return YouthOrganization.objects.create(name=name, classification='community_based', sub_classification='youth_org', barangay='Ilayang Talim', **kw)

        self.public = mk('Public Org', is_active=True, status='approved', submitted_by=self.leader, description='We help.', mission='Serve',
                         how_to_join='Message us', membership_requirements='Age 15-30', facebook_url='https://www.facebook.com/publicorg',
                         admin_notes='SECRET NOTE')
        self.pending = mk('Pending Org', is_active=False, status='pending')
        self.inactive = mk('Inactive Org', is_active=False, status='approved')
        self.rejected = mk('Rejected Org', is_active=False, status='rejected')
        self.private_flag = mk('Active But Pending', is_active=True, status='pending')
        self.closed = mk('Closed Org', is_active=True, status='approved', accepting_members=False)
        OrgAccomplishment.objects.create(organization=self.public, title='Won a prize')
        OrgAccomplishment.objects.create(organization=self.pending, title='Hidden prize')
        OrgRequirement.objects.create(organization=self.public, name='Charter', is_submitted=True)
        from apps.verification.models import IDVerification
        for u in (self.youth, self.sk):  # applying needs a verified account
            IDVerification.objects.create(user=u, id_type='umid', status='approved')
        self.anon, self.yc, self.lc, self.skc, self.sc, self.ac = (APIClient() for _ in range(6))
        self.yc.force_authenticate(self.youth)
        self.lc.force_authenticate(self.leader)
        self.skc.force_authenticate(self.sk)
        self.sc.force_authenticate(self.stranger)
        self.ac.force_authenticate(self.admin)

    def names(self, client, **params):
        return {o['name'] for o in client.get('/api/youth-orgs/', params).data}

    # TEST 1, 6, 7
    def test_everyone_browses_the_public_directory_without_signing_in(self):
        for client in (self.anon, self.yc, self.skc, self.lc):
            self.assertEqual(self.names(client), {'Public Org', 'Closed Org'})

    # TEST 9
    def test_only_public_organizations_are_listed_or_reachable(self):
        for org in (self.pending, self.inactive, self.rejected, self.private_flag):
            self.assertEqual(self.anon.get(f'/api/youth-orgs/{org.pk}/').status_code, 404, org.name)
        self.assertEqual(self.names(self.ac), {o.name for o in YouthOrganization.objects.all()})  # the administrator still sees all

    # TEST 2, 8
    def test_the_public_profile_has_no_private_data(self):
        d = self.anon.get(f'/api/youth-orgs/{self.public.pk}/').data
        for key in ('mission', 'how_to_join', 'membership_requirements', 'facebook_url', 'accepting_members', 'accomplishments'):
            self.assertIn(key, d)
        for private in ('admin_notes', 'requirements', 'status', 'is_active', 'submitted_by', 'logo'):
            self.assertNotIn(private, d, private)
        self.assertNotIn('SECRET NOTE', str(d))
        self.assertEqual([a['title'] for a in d['accomplishments']], ['Won a prize'])
        self.assertNotIn('SECRET NOTE', str(self.anon.get('/api/youth-orgs/').data))
        self.assertNotIn('Hidden prize', str(self.anon.get(f'/api/youth-orgs/{self.pending.pk}/accomplishments/').data))

    # TEST 8
    def test_protected_endpoints_deny_visitors_and_ordinary_accounts(self):
        pk = self.public.pk
        for client in (self.anon, self.yc, self.sc):
            self.assertIn(client.get(f'/api/youth-orgs/{pk}/requirements/').status_code, (401, 403))
            self.assertIn(client.patch(f'/api/youth-orgs/{pk}/', {'name': 'x'}, format='json').status_code, (401, 403))
            self.assertIn(client.post(f'/api/youth-orgs/{pk}/approve/', {}, format='json').status_code, (401, 403))
            self.assertIn(client.get(f'/api/youth-orgs/{pk}/applications/').status_code, (401, 403))
        self.assertEqual(self.anon.get('/api/youth-orgs/my-applications/').status_code, 401)

    # TEST 3 (server side): a visitor cannot apply
    def test_a_visitor_cannot_apply(self):
        self.assertEqual(self.anon.post(f'/api/youth-orgs/{self.public.pk}/apply/', {'message': 'hi'}, format='json').status_code, 401)
        self.assertFalse(OrgMembershipApplication.objects.exists())

    # TEST 5, 6, 7
    def test_signed_in_users_apply_once_and_the_leader_is_told(self):
        url = f'/api/youth-orgs/{self.public.pk}/apply/'
        r = self.yc.post(url, {'message': 'I love volunteering', 'consent': 'true'}, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(self.yc.post(url, {}, format='json').status_code, 400)  # only once
        self.assertEqual(self.skc.post(url, {'consent': 'true'}, format='json').status_code, 201)  # an SK official may apply too
        self.assertTrue(Notification.objects.filter(user=self.leader, title='New membership application').exists())
        self.assertTrue(Notification.objects.filter(user=self.youth, title='Membership application sent').exists())
        self.assertFalse(Notification.objects.filter(user=self.admin, title='New membership application').exists())  # the organization's officers review it, not LYDO
        self.assertEqual(self.lc.post(url, {}, format='json').status_code, 400)  # the leader already manages it
        self.assertEqual(len(self.yc.get('/api/youth-orgs/my-applications/').data), 1)

    def test_nobody_can_apply_to_an_organization_that_is_not_public_or_not_accepting(self):
        self.assertEqual(self.yc.post(f'/api/youth-orgs/{self.pending.pk}/apply/', {}, format='json').status_code, 404)
        self.assertEqual(self.yc.post(f'/api/youth-orgs/{self.closed.pk}/apply/', {}, format='json').status_code, 400)

    def test_only_the_leader_and_admin_see_and_decide_applications(self):
        self.yc.post(f'/api/youth-orgs/{self.public.pk}/apply/', {'message': 'hi', 'consent': 'true'}, format='json')
        app = OrgMembershipApplication.objects.get()
        list_url = f'/api/youth-orgs/{self.public.pk}/applications/'
        self.assertEqual(self.yc.get(list_url).status_code, 403)
        self.assertEqual(self.sc.get(list_url).status_code, 403)
        self.assertEqual(len(self.lc.get(list_url).data), 1)
        self.assertEqual(len(self.ac.get(list_url).data), 1)
        decide = f'/api/youth-orgs/{self.public.pk}/decide-application/'
        self.assertEqual(self.yc.post(decide, {'application': app.pk, 'status': 'accepted'}, format='json').status_code, 403)
        self.assertEqual(self.lc.post(decide, {'application': app.pk, 'status': 'declined'}, format='json').status_code, 400)  # needs a reason
        self.assertEqual(self.lc.post(decide, {'application': app.pk, 'status': 'accepted'}, format='json').status_code, 200)
        self.assertTrue(Notification.objects.filter(user=self.youth, title='Membership approved').exists())

    def test_the_public_profile_tells_the_leader_they_can_manage(self):
        self.assertTrue(self.lc.get(f'/api/youth-orgs/{self.public.pk}/').data['can_manage'])
        self.assertFalse(self.yc.get(f'/api/youth-orgs/{self.public.pk}/').data['can_manage'])

    def test_search_and_the_recruiting_filter_work_for_visitors(self):
        self.assertEqual(self.names(self.anon, accepting='true'), {'Public Org'})
        self.assertEqual(self.names(self.anon, search='Closed'), {'Closed Org'})
        self.assertEqual(self.names(self.anon, barangay='Talim'), {'Public Org', 'Closed Org'})

    def test_admin_can_set_the_public_profile_and_a_bad_facebook_link_is_refused(self):
        url = f'/api/youth-orgs/{self.public.pk}/'
        self.assertEqual(self.ac.patch(url, {'facebook_url': 'https://evil.com/x'}, format='json').status_code, 400)
        r = self.ac.patch(url, {'mission': 'New mission', 'accepting_members': False, 'facebook_url': 'facebook.com/neworg'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        d = self.anon.get(url).data
        self.assertEqual((d['mission'], d['accepting_members'], d['facebook_url']), ('New mission', False, 'https://www.facebook.com/neworg'))
