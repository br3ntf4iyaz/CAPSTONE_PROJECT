from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient

from .models import YouthOrganization


class AddPublicOrgsTests(TestCase):
    def test_the_three_clubs_are_added_once_and_listed_publicly_as_not_yet_registered(self):
        call_command('add_public_orgs')
        call_command('add_public_orgs')  # running it again adds nothing
        self.assertEqual(YouthOrganization.objects.count(), 3)
        listing = APIClient().get('/api/youth-orgs/').data
        self.assertEqual({o['name'] for o in listing}, {'Rotaract Club of Lucena South', 'Rotaract Club of Metro Lucena', 'Rotaract Club of Lucena Promenade'})
        for o in listing:
            self.assertEqual(o['registration_category'], 'not_registered')  # never claimed as registered
            self.assertEqual(o['application_mode'], 'contact')

    def test_nothing_is_invented_and_the_admin_note_stays_private(self):
        call_command('add_public_orgs')
        org = YouthOrganization.objects.get(name='Rotaract Club of Lucena South')
        self.assertEqual((org.contact_email, org.contact_phone, org.contact_person, org.registration_number), ('', '', '', ''))
        self.assertEqual(org.officers.count(), 0)
        detail = APIClient().get(f'/api/youth-orgs/{org.pk}/').data
        self.assertNotIn('admin_notes', detail)
        self.assertIn('NOT verified', org.admin_notes)
        self.assertEqual(org.source_url, '')  # no link is shown that nobody could open
        self.assertNotIn('charter', org.description)  # nothing is claimed beyond the club name

    def test_an_existing_organization_is_left_as_it_is(self):
        YouthOrganization.objects.create(name='Rotaract Club of Lucena South', classification='school_based', sub_classification='youth_org',
                                         description='LYDO edited this', status='approved', is_active=True)
        call_command('add_public_orgs')
        self.assertEqual(YouthOrganization.objects.get(name='Rotaract Club of Lucena South').description, 'LYDO edited this')
        self.assertEqual(YouthOrganization.objects.count(), 3)

    def test_entries_added_earlier_lose_the_dead_links_and_the_claims_but_lydos_edits_stay(self):
        from .management.commands.add_public_orgs import OLD_DESCRIPTIONS, OLD_SOURCES
        call_command('add_public_orgs')
        South, Metro, Prom = 'Rotaract Club of Lucena South', 'Rotaract Club of Metro Lucena', 'Rotaract Club of Lucena Promenade'
        # how they were first written
        YouthOrganization.objects.filter(name=South).update(description=OLD_DESCRIPTIONS[South], source_url=OLD_SOURCES[0], admin_notes='Added from public sources for the system demo.')
        YouthOrganization.objects.filter(name=Prom).update(description=OLD_DESCRIPTIONS[Prom], source_url=OLD_SOURCES[2])
        YouthOrganization.objects.filter(name=Metro).update(description='LYDO edited this', source_url='https://example.org/lydo-source')
        call_command('add_public_orgs')
        south = YouthOrganization.objects.get(name=South)
        self.assertEqual(south.source_url, '')
        self.assertNotIn('charter', south.description)
        self.assertIn('NOT verified', south.admin_notes)
        self.assertEqual(YouthOrganization.objects.get(name=Prom).source_url, '')
        metro = YouthOrganization.objects.get(name=Metro)
        self.assertEqual((metro.description, metro.source_url), ('LYDO edited this', 'https://example.org/lydo-source'))  # LYDO's own edit and link stay

    def test_lydo_can_change_the_source_and_only_a_web_link_is_accepted(self):
        from django.contrib.auth import get_user_model
        call_command('add_public_orgs')
        admin = get_user_model().objects.create_user(email='ad@t.local', password='x', role='lgu_admin', is_active=True)
        c = APIClient()
        c.force_authenticate(admin)
        pk = YouthOrganization.objects.first().pk
        self.assertEqual(c.patch(f'/api/youth-orgs/{pk}/', {'source_url': 'javascript:alert(1)'}, format='json').status_code, 400)
        self.assertEqual(c.patch(f'/api/youth-orgs/{pk}/', {'source_url': ''}, format='json').status_code, 200)

    def test_the_demo_clubs_are_open_for_members_and_visible_to_every_kind_of_user(self):
        from django.contrib.auth import get_user_model
        call_command('add_public_orgs')
        U = get_user_model()
        sk = U.objects.create_user(email='sk@t.local', password='x', role='youth', youth_type='sk', is_active=True)
        gy = U.objects.create_user(email='gy@t.local', password='x', role='youth', youth_type='general_youth', is_active=True)
        leader = U.objects.create_user(email='ld@t.local', password='x', role='youth', youth_type='youth_org_leader', is_active=True)
        for user in (None, sk, gy, leader):
            c = APIClient()
            if user:
                c.force_authenticate(user)
            rows = c.get('/api/youth-orgs/').data
            self.assertEqual(len(rows), 3)
            self.assertTrue(all(o['accepting_members'] for o in rows))

    def test_open_existing_opens_only_an_untouched_demo_entry(self):
        from .management.commands.add_public_orgs import OLD_HOW
        call_command('add_public_orgs')
        YouthOrganization.objects.filter(name='Rotaract Club of Lucena South').update(accepting_members=False, how_to_join=OLD_HOW)
        YouthOrganization.objects.filter(name='Rotaract Club of Metro Lucena').update(accepting_members=False, how_to_join='LYDO wrote this')
        call_command('add_public_orgs', open_existing=True)
        self.assertTrue(YouthOrganization.objects.get(name='Rotaract Club of Lucena South').accepting_members)
        self.assertFalse(YouthOrganization.objects.get(name='Rotaract Club of Metro Lucena').accepting_members)  # LYDO's edit is respected
