from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient

from .models import YouthOrganization

NAMES = {'Supreme Student Council - SLSU Lucena Campus', 'University Collegiate Student Council - MSEUF', 'Kaya Natin! Youth - Lucena'}


class AddPublicOrgsTests(TestCase):
    def test_the_clubs_are_added_once_and_listed_publicly_as_not_yet_registered(self):
        call_command('add_public_orgs')
        call_command('add_public_orgs')  # running it again adds nothing
        self.assertEqual(YouthOrganization.objects.count(), 3)
        listing = APIClient().get('/api/youth-orgs/').data
        self.assertEqual({o['name'] for o in listing}, NAMES)
        for o in listing:
            self.assertEqual(o['registration_category'], 'not_registered')  # never claimed as registered
            self.assertEqual(o['application_mode'], 'contact')

    def test_every_entry_has_a_web_source_and_nothing_is_invented(self):
        call_command('add_public_orgs')
        for org in YouthOrganization.objects.all():
            self.assertTrue(org.source_url.startswith('https://'), org.name)
            self.assertEqual((org.contact_email, org.contact_phone, org.contact_person, org.registration_number), ('', '', '', ''))
            self.assertEqual(org.officers.count(), 0)
            detail = APIClient().get(f'/api/youth-orgs/{org.pk}/').data
            self.assertNotIn('admin_notes', detail)  # the admin note stays private
            self.assertEqual(detail['source_url'], org.source_url)

    def test_student_councils_are_not_shown_as_recruiting_but_the_youth_chapter_is_open(self):
        call_command('add_public_orgs')
        by_name = {o['name']: o['accepting_members'] for o in APIClient().get('/api/youth-orgs/').data}
        self.assertFalse(by_name['Supreme Student Council - SLSU Lucena Campus'])
        self.assertFalse(by_name['University Collegiate Student Council - MSEUF'])
        self.assertTrue(by_name['Kaya Natin! Youth - Lucena'])

    def test_an_existing_organization_is_left_as_it_is(self):
        YouthOrganization.objects.create(name='Kaya Natin! Youth - Lucena', classification='school_based', sub_classification='youth_org',
                                         description='LYDO edited this', status='approved', is_active=True)
        call_command('add_public_orgs')
        self.assertEqual(YouthOrganization.objects.get(name='Kaya Natin! Youth - Lucena').description, 'LYDO edited this')
        self.assertEqual(YouthOrganization.objects.count(), 3)

    def test_the_unconfirmed_rotaract_clubs_are_removed_only_while_untouched(self):
        from .management.commands.add_public_orgs import UNVERIFIED_MARKS
        mk = lambda name, notes, desc='x': YouthOrganization.objects.create(
            name=name, classification='community_based', sub_classification='youth_serving', description=desc, admin_notes=notes, status='approved', is_active=True)
        mk('Rotaract Club of Lucena South', UNVERIFIED_MARKS[0] + ' Not yet confirmed')
        mk('Rotaract Club of Metro Lucena', 'LYDO wrote this note', 'LYDO edited this')
        call_command('add_public_orgs')
        self.assertFalse(YouthOrganization.objects.filter(name='Rotaract Club of Lucena South').exists())
        self.assertTrue(YouthOrganization.objects.filter(name='Rotaract Club of Metro Lucena').exists())  # edited by LYDO: kept

    def test_lydo_can_change_the_source_and_only_a_web_link_is_accepted(self):
        call_command('add_public_orgs')
        admin = get_user_model().objects.create_user(email='ad@t.local', password='x', role='lgu_admin', is_active=True)
        c = APIClient()
        c.force_authenticate(admin)
        pk = YouthOrganization.objects.first().pk
        self.assertEqual(c.patch(f'/api/youth-orgs/{pk}/', {'source_url': 'javascript:alert(1)'}, format='json').status_code, 400)
        self.assertEqual(c.patch(f'/api/youth-orgs/{pk}/', {'source_url': ''}, format='json').status_code, 200)

    def test_the_clubs_are_visible_to_every_kind_of_user(self):
        call_command('add_public_orgs')
        U = get_user_model()
        users = [None] + [U.objects.create_user(email=f'{t}@t.local', password='x', role='youth', youth_type=t, is_active=True)
                          for t in ('sk', 'general_youth', 'youth_org_leader')]
        for user in users:
            c = APIClient()
            if user:
                c.force_authenticate(user)
            self.assertEqual({o['name'] for o in c.get('/api/youth-orgs/').data}, NAMES)
