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
