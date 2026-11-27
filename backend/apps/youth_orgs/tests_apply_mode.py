from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.notifications.models import Notification
from apps.verification.models import IDVerification

from .models import OrgMembershipApplication, YouthOrganization

User = get_user_model()


class ApplyModeTests(TestCase):
    def setUp(self):
        self.leader = User.objects.create_user(email='leader@t.local', password='x', role='youth', youth_type='youth_org_leader', is_active=True)
        self.admin = User.objects.create_user(email='ad@t.local', password='x', role='lgu_admin', is_active=True)
        self.person = User.objects.create_user(email='p@t.local', password='x', role='youth', is_active=True)
        IDVerification.objects.create(user=self.person, id_type='umid', status='approved')
        self.pc, self.ac, self.anon = APIClient(), APIClient(), APIClient()
        self.pc.force_authenticate(self.person)
        self.ac.force_authenticate(self.admin)

    def org(self, name='Org', **kw):
        return YouthOrganization.objects.create(name=name, classification='community_based', sub_classification='youth_org',
                                                barangay='Ilayang Talim', is_active=True, status='approved', **kw)

    def apply(self, org):
        return self.pc.post(f'/api/youth-orgs/{org.pk}/apply/', {'message': 'hi', 'consent': 'true'}, format='json')

    def test_an_external_or_contact_only_organization_cannot_be_applied_to_inside_lydop(self):
        ext = self.org('Ext', application_mode='external', external_apply_url='https://forms.gle/abc')
        r = self.apply(ext)
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data['code'], 'external_application')
        self.assertEqual(r.data['external_apply_url'], 'https://forms.gle/abc')
        self.assertEqual(self.apply(self.org('Contact', application_mode='contact')).status_code, 400)
        self.assertFalse(OrgMembershipApplication.objects.exists())

    def test_an_in_app_organization_still_takes_applications_and_its_officer_is_told_not_lydo(self):
        o = self.org(submitted_by=self.leader)
        self.assertEqual(self.apply(o).status_code, 201)
        self.assertTrue(Notification.objects.filter(user=self.leader, title='New membership application').exists())
        self.assertFalse(Notification.objects.filter(user=self.admin, title='New membership application').exists())

    def test_lydo_looks_after_applications_only_when_no_officer_account_is_linked(self):
        o = self.org('No leader')
        self.assertEqual(self.apply(o).status_code, 201)
        self.assertTrue(Notification.objects.filter(user=self.admin, title='New membership application').exists())

    def test_the_public_sees_how_to_apply_and_the_registration_details(self):
        o = self.org('Reg', application_mode='external', external_apply_url='https://forms.gle/abc', acronym='RYO',
                     registration_number='YORP-2026-001', registration_valid_until='2027-12-31', submitted_by=self.leader, admin_notes='SECRET')
        d = self.anon.get(f'/api/youth-orgs/{o.pk}/').data
        self.assertEqual((d['application_mode'], d['external_apply_url'], d['acronym']), ('external', 'https://forms.gle/abc', 'RYO'))
        self.assertEqual((d['registration_number'], d['registration_valid_until'], d['has_officer_reviewer']), ('YORP-2026-001', '2027-12-31', True))
        self.assertNotIn('admin_notes', d)
        self.assertEqual(self.anon.get('/api/youth-orgs/').data[0]['application_mode'], 'external')

    def test_lydo_sets_the_mode_and_a_bad_link_is_refused(self):
        o = self.org()
        url = f'/api/youth-orgs/{o.pk}/'
        self.assertEqual(self.ac.patch(url, {'application_mode': 'external'}, format='json').status_code, 400)  # a link is needed
        self.assertEqual(self.ac.patch(url, {'application_mode': 'external', 'external_apply_url': 'javascript:alert(1)'}, format='json').status_code, 400)
        r = self.ac.patch(url, {'application_mode': 'external', 'external_apply_url': 'forms.gle/abc', 'registration_number': 'YORP-1'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        o.refresh_from_db()
        self.assertEqual((o.application_mode, o.external_apply_url, o.registration_number), ('external', 'https://forms.gle/abc', 'YORP-1'))
        self.assertEqual(self.pc.patch(url, {'application_mode': 'contact'}, format='json').status_code, 403)

    def test_an_sk_official_and_a_leader_can_join_another_organization_but_not_their_own(self):
        sk = User.objects.create_user(email='sk@t.local', password='x', role='youth', youth_type='sk', is_active=True)
        IDVerification.objects.create(user=sk, id_type='umid', status='approved')
        org = self.org('Someone Elses', submitted_by=self.leader)
        own = self.org('Own', submitted_by=sk)
        c = APIClient()
        c.force_authenticate(sk)
        self.assertEqual(c.post(f'/api/youth-orgs/{org.pk}/apply/', {'consent': 'true'}, format='json').status_code, 201)  # another organization
        self.assertEqual(c.post(f'/api/youth-orgs/{own.pk}/apply/', {'consent': 'true'}, format='json').status_code, 400)  # their own
        other = User.objects.create_user(email='ld2@t.local', password='x', role='youth', youth_type='youth_org_leader', is_active=True)
        IDVerification.objects.create(user=other, id_type='umid', status='approved')
        c2 = APIClient()
        c2.force_authenticate(other)
        self.assertEqual(c2.post(f'/api/youth-orgs/{org.pk}/apply/', {'consent': 'true'}, format='json').status_code, 201)
