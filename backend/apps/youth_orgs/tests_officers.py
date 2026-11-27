from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import AuditLog
from apps.verification.models import IDVerification

from .models import YouthOrganization

User = get_user_model()
BASE = '/api/youth-orgs/'


class OfficersAndOwnershipTests(TestCase):
    def setUp(self):
        self.leader = User.objects.create_user(email='leader@t.local', password='x', first_name='Lea', last_name='Der', role='youth', youth_type='youth_org_leader', is_active=True)
        self.other = User.objects.create_user(email='other@t.local', password='x', role='youth', youth_type='youth_org_leader', is_active=True)
        self.admin = User.objects.create_user(email='ad@t.local', password='x', role='lgu_admin', is_active=True)
        self.sk = User.objects.create_user(email='sk@t.local', password='x', role='youth', youth_type='sk', is_active=True)
        for u in (self.leader, self.other):
            IDVerification.objects.create(user=u, id_type='umid', status='approved')
        self.lc, self.oc, self.ac, self.skc, self.anon = (APIClient() for _ in range(5))
        self.lc.force_authenticate(self.leader)
        self.oc.force_authenticate(self.other)
        self.ac.force_authenticate(self.admin)
        self.skc.force_authenticate(self.sk)

    def create(self, name='Org A', **extra):
        data = {'name': name, 'classification': 'community_based', 'sub_classification': 'youth_org', 'barangay': 'Ilayang Talim',
                'my_position': 'president',
                'officers_input': [{'position': 'secretary', 'name': 'Sam Secretary'}, {'position': 'treasurer', 'name': 'Tina Treasurer'},
                                   {'position': 'auditor', 'name': 'Al Auditor'}, {'position': 'pro', 'name': 'Pia PRO'}]}
        data.update(extra)
        return self.lc.post(BASE, data, format='json')

    def names(self, client):
        return {o['name'] for o in client.get(BASE).data}

    def test_one_leader_registers_several_organizations_and_each_waits_for_lydo(self):
        a, b = self.create('Org A'), self.create('Org B', my_position='secretary', officers_input=[])
        self.assertEqual((a.status_code, b.status_code), (201, 201), (a.data, b.data))
        self.assertEqual({o.status for o in YouthOrganization.objects.filter(submitted_by=self.leader)}, {'pending'})
        mine = self.lc.get(BASE + 'my-submissions/').data
        self.assertEqual({m['name'] for m in mine}, {'Org A', 'Org B'})
        # LYDO approves one: the other stays hidden
        org_a = YouthOrganization.objects.get(name='Org A')
        self.assertEqual(self.ac.post(f'{BASE}{org_a.pk}/approve/', {'registration_category': 'lydo'}, format='json').status_code, 200)
        for c in (self.anon, self.oc, self.skc):
            self.assertEqual(self.names(c), {'Org A'})
        self.assertEqual(self.names(self.ac), {'Org A', 'Org B'})

    def test_a_pending_organization_is_not_public_for_anyone_but_its_leader_and_lydo(self):
        self.create('Hidden')
        pk = YouthOrganization.objects.get(name='Hidden').pk
        for c in (self.anon, self.oc, self.skc):
            self.assertEqual(c.get(f'{BASE}{pk}/').status_code, 404)
        self.assertEqual(self.lc.get(f'{BASE}{pk}/manage/').status_code, 200)
        self.assertEqual(self.oc.get(f'{BASE}{pk}/manage/').status_code, 404)
        self.assertEqual(self.anon.get(f'{BASE}{pk}/manage/').status_code, 401)

    def test_the_creator_is_linked_to_their_position_and_the_public_sees_only_outward_officers(self):
        self.create('Org A')
        org = YouthOrganization.objects.get(name='Org A')
        self.assertEqual(org.officers.filter(user=self.leader).get().position, 'president')
        self.ac.post(f'{BASE}{org.pk}/approve/', {'registration_category': 'lydo'}, format='json')
        public = self.anon.get(f'{BASE}{org.pk}/').data['officers']
        self.assertEqual({o['position'] for o in public}, {'president', 'secretary', 'pro'})
        self.assertNotIn('Tina Treasurer', str(public))
        for c in (self.lc, self.ac):
            full = c.get(f'{BASE}{org.pk}/').data['officers']
            self.assertEqual({o['position'] for o in full}, {'president', 'secretary', 'pro', 'treasurer', 'auditor'})
        self.assertEqual(set(o['position'] for o in self.oc.get(f'{BASE}{org.pk}/').data['officers']), {'president', 'secretary', 'pro'})
        self.assertEqual(set(o['position'] for o in self.skc.get(f'{BASE}{org.pk}/').data['officers']), {'president', 'secretary', 'pro'})

    def test_bad_officer_lists_are_refused(self):
        self.assertEqual(self.create(officers_input=[{'position': 'king', 'name': 'X'}]).status_code, 400)
        self.assertEqual(self.create(officers_input=[{'position': 'other', 'name': 'X'}]).status_code, 400)  # a custom title is needed
        self.assertEqual(self.create(officers_input=[{'position': 'president', 'name': 'Second President'}]).status_code, 400)  # one president
        self.assertEqual(self.create(officers_input=[{'position': 'secretary', 'name': ''}]).status_code, 400)
        self.assertFalse(YouthOrganization.objects.exists())

    def test_the_leader_edits_the_public_profile_but_not_the_registration(self):
        self.create('Org A')
        org = YouthOrganization.objects.get(name='Org A')
        url = f'{BASE}{org.pk}/manage/'
        r = self.lc.patch(url, {'mission': 'Serve', 'accepting_members': False, 'application_mode': 'contact', 'status': 'approved',
                                'is_active': True, 'registration_category': 'nyc', 'name': 'Renamed', 'registration_number': 'FAKE-1'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        org.refresh_from_db()
        self.assertEqual((org.mission, org.accepting_members, org.application_mode), ('Serve', False, 'contact'))
        self.assertEqual((org.status, org.is_active, org.registration_category, org.name, org.registration_number), ('pending', False, 'not_registered', 'Org A', ''))
        self.assertEqual(self.lc.patch(url, {'application_mode': 'external'}, format='json').status_code, 400)  # a link is needed
        self.assertEqual(self.oc.patch(url, {'mission': 'Hijack'}, format='json').status_code, 404)
        self.assertTrue(AuditLog.objects.filter(action='org_managed').exists())

    def test_the_leader_replaces_the_officers_and_only_the_leader_can(self):
        self.create('Org A')
        org = YouthOrganization.objects.get(name='Org A')
        url = f'{BASE}{org.pk}/set-officers/'
        rows = [{'position': 'president', 'name': 'Lea Der', 'is_me': True}, {'position': 'sergeant', 'name': 'Sarge'},
                {'position': 'other', 'custom_title': 'Auditor-General', 'name': 'Gen Eral'}]
        r = self.lc.post(url, {'officers': rows}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual({o['position_label'] for o in r.data}, {'President', 'Sergeant-at-Arms / Peace Officer', 'Auditor-General'})
        self.assertEqual(org.officers.count(), 3)
        self.assertEqual(org.officers.filter(user=self.leader).count(), 1)
        self.assertEqual(self.oc.post(url, {'officers': rows}, format='json').status_code, 404)
        self.assertEqual(self.lc.post(url, {'officers': [{'position': 'x', 'name': 'y'}]}, format='json').status_code, 400)
        self.assertEqual(org.officers.count(), 3)  # a bad list changes nothing

    def test_the_directory_tells_each_viewer_which_organizations_are_theirs(self):
        self.create('Org A')
        org = YouthOrganization.objects.get(name='Org A')
        self.ac.post(f'{BASE}{org.pk}/approve/', {'registration_category': 'lydo'}, format='json')
        self.assertTrue(self.lc.get(BASE).data[0]['is_mine'])
        for c in (self.oc, self.skc, self.anon):
            self.assertFalse(c.get(BASE).data[0]['is_mine'])

    def test_lydo_and_the_leader_are_notified_when_an_organization_is_registered(self):
        from apps.notifications.models import Notification
        self.create('Org A')
        self.assertTrue(Notification.objects.filter(user=self.admin, title='New organization to verify', message__contains='Org A').exists())
        self.assertTrue(Notification.objects.filter(user=self.leader, title='Organization submitted').exists())
        self.assertFalse(Notification.objects.filter(user=self.other).exists())
