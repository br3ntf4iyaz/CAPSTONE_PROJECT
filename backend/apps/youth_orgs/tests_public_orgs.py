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
        self.assertIn('Not yet confirmed by LYDO', org.admin_notes)

    def test_an_existing_organization_is_left_as_it_is(self):
        YouthOrganization.objects.create(name='Rotaract Club of Lucena South', classification='school_based', sub_classification='youth_org',
                                         description='LYDO edited this', status='approved', is_active=True)
        call_command('add_public_orgs')
        self.assertEqual(YouthOrganization.objects.get(name='Rotaract Club of Lucena South').description, 'LYDO edited this')
        self.assertEqual(YouthOrganization.objects.count(), 3)

    def test_each_organization_shows_where_its_information_comes_from(self):
        call_command('add_public_orgs')
        for org in YouthOrganization.objects.all():
            d = APIClient().get(f'/api/youth-orgs/{org.pk}/').data
            self.assertTrue(d['source_url'].startswith('https://'), org.name)
        # an entry added before the source existed gets it, and nothing else about it changes
        YouthOrganization.objects.filter(name='Rotaract Club of Metro Lucena').update(source_url='', description='LYDO edited this')
        call_command('add_public_orgs')
        o = YouthOrganization.objects.get(name='Rotaract Club of Metro Lucena')
        self.assertEqual((o.description, bool(o.source_url)), ('LYDO edited this', True))

    def test_lydo_can_change_the_source_and_only_a_web_link_is_accepted(self):
        from django.contrib.auth import get_user_model
        call_command('add_public_orgs')
        admin = get_user_model().objects.create_user(email='ad@t.local', password='x', role='lgu_admin', is_active=True)
        c = APIClient()
        c.force_authenticate(admin)
        pk = YouthOrganization.objects.first().pk
        self.assertEqual(c.patch(f'/api/youth-orgs/{pk}/', {'source_url': 'javascript:alert(1)'}, format='json').status_code, 400)
        self.assertEqual(c.patch(f'/api/youth-orgs/{pk}/', {'source_url': ''}, format='json').status_code, 200)
