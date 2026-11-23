from django.core.management import call_command
from rest_framework.test import APITestCase

from apps.accounts.models import User
from .management.commands.seed_verified_resources import RESOURCES
from .models import Resource


class VerifiedLibraryTests(APITestCase):
    def setUp(self):
        call_command('seed_verified_resources', verbosity=0)

    def test_seed_is_idempotent_and_never_duplicates(self):
        before = Resource.objects.count()
        call_command('seed_verified_resources', verbosity=0)
        self.assertEqual(Resource.objects.count(), before)
        self.assertEqual(before, len(RESOURCES))

    def test_every_entry_has_a_real_link_a_publisher_and_a_source_kind(self):
        urls = [r['external_url'] for r in RESOURCES]
        self.assertEqual(len(urls), len(set(urls)), 'duplicate links')
        for r in RESOURCES:
            self.assertTrue(r['external_url'].startswith(('https://', 'http://')), r['title'])
            self.assertTrue(r['author'], r['title'])
            self.assertTrue(r['source_kind'], r['title'])
            self.assertTrue(r['title'].strip() and r['description'].strip(), r['title'])

    def test_education_leadership_and_other_are_no_longer_empty(self):
        for cat in ('education', 'leadership', 'other'):
            self.assertGreater(Resource.objects.filter(category=cat, is_published=True).count(), 0, cat)

    def test_list_returns_every_record_not_only_the_first_20(self):
        total = Resource.objects.filter(is_published=True).count()
        self.assertGreater(total, 20)
        data = self.client.get('/api/resources/').data
        self.assertEqual(len(data['results']), total)

    def test_search_finds_by_organization_and_topic(self):
        titles = [r['title'] for r in self.client.get('/api/resources/', {'search': 'TESDA'}).data['results']]
        self.assertTrue(any('TESDA' in t for t in titles))
        titles = [r['title'] for r in self.client.get('/api/resources/', {'search': 'earthquake'}).data['results']]
        self.assertTrue(any('PHIVOLCS' in t for t in titles))

    def test_download_prefers_the_official_download_link(self):
        user = User.objects.create_user(email='y@x.com', password='p', role='youth', is_active=True)
        self.client.force_authenticate(user)
        res = Resource.objects.get(title='Sangguniang Kabataan Operations Manual 2023')
        data = self.client.get(f'/api/resources/{res.id}/download/').data
        self.assertIn('uc?export=download', data['file_url'])

    def test_repairs_fix_only_the_exact_dead_link(self):
        dead = 'https://www.dilg.gov.ph/PDF_File/issuances/mc/dilg-issuances-2016915-f00e4a4f31.pdf'
        keep = Resource.objects.create(title='A', description='d', resource_type='link', category='legal', external_url=dead, is_published=True)
        other = Resource.objects.create(title='B', description='d', resource_type='link', category='legal',
                                        external_url='https://example.org/fixed-by-admin', is_published=True)
        call_command('seed_verified_resources', verbosity=0)
        keep.refresh_from_db()
        other.refresh_from_db()
        self.assertEqual(keep.external_url, '')
        self.assertIn('stopped working', keep.status_note)
        self.assertEqual(other.external_url, 'https://example.org/fixed-by-admin')

    def test_admin_can_edit_library_fields(self):
        admin = User.objects.create_user(email='a@x.com', password='p', role='lgu_admin', is_active=True)
        self.client.force_authenticate(admin)
        res = Resource.objects.first()
        r = self.client.patch(f'/api/resources/{res.id}/', {'author': 'New <b>Author</b>', 'status_note': 'Updated'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data['author'], 'New Author')
