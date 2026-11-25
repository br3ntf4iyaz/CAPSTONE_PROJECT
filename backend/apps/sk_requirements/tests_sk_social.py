from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from apps.verification.models import IDVerification

from . import social as rules
from .models import SKBarangay, SKMember, SKOfficialSocial

User = get_user_model()
FB = 'https://www.facebook.com/kim.ebarle'


class SKSocialTests(TestCase):
    def setUp(self):
        self.a = SKBarangay.objects.create(barangay_name='Barangay A', sk_chairperson='Kim Ebarle')
        self.b = SKBarangay.objects.create(barangay_name='Barangay B', sk_chairperson='Chair B')
        self.kag = SKMember.objects.create(barangay=self.a, position='kagawad', name='Rafael Aquino', order=1)
        self.admin = User.objects.create_user(email='adm@t.local', password='x', role='lgu_admin', is_active=True)
        self.youth = User.objects.create_user(email='yt@t.local', password='x', role='youth', is_active=True)
        self.sk = User.objects.create_user(email='sk@t.local', password='x', role='youth', youth_type='sk', is_active=True)
        self.sk.profile.barangay = 'Barangay A'
        self.sk.profile.save()
        IDVerification.objects.create(user=self.sk, id_type='umid', status='approved')
        self.ac, self.yc, self.skc, self.anon = APIClient(), APIClient(), APIClient(), APIClient()
        self.ac.force_authenticate(self.admin)
        self.yc.force_authenticate(self.youth)
        self.skc.force_authenticate(self.sk)

    def save(self, client, body, barangay=None):
        return client.post(f'/api/sk-requirements/barangays/{(barangay or self.a).pk}/official-social/', body, format='json')

    def official(self, data, key):
        return next(o for o in data['officials'] if o['key'] == key)

    # --- link rules ---
    def test_only_real_facebook_links_are_accepted_and_they_are_normalised(self):
        ok = {'facebook.com/kim.ebarle': 'https://www.facebook.com/kim.ebarle',
              'https://m.facebook.com/kim.ebarle?ref=x': 'https://www.facebook.com/kim.ebarle',
              'https://www.facebook.com/profile.php?id=100012345678': 'https://www.facebook.com/profile.php?id=100012345678',
              'https://www.facebook.com/pages/SK-Ilayang-Talim/123456789': 'https://www.facebook.com/pages/SK-Ilayang-Talim/123456789/'}
        for given, expected in ok.items():
            self.assertEqual(rules.clean_facebook_url(given), expected, given)
        for bad in ('http://evil.com/facebook.com/x', 'https://facebook.com.evil.com/x', 'javascript:alert(1)', 'https://www.facebook.com/',
                    'https://www.facebook.com/login', 'https://www.facebook.com/profile.php?id=abc', 'https://user:pw@www.facebook.com/x',
                    'https://www.facebook.com/a b', 'ftp://www.facebook.com/x', 'https://www.facebook.com/sharer.php?u=1', 'just words'):
            with self.assertRaises(ValidationError, msg=bad):
                rules.clean_facebook_url(bad)
        self.assertEqual(rules.clean_facebook_url(''), '')

    def test_messenger_links(self):
        self.assertEqual(rules.clean_messenger_url('m.me/kim.ebarle'), 'https://m.me/kim.ebarle')
        self.assertEqual(rules.clean_messenger_url('https://www.messenger.com/t/kim.ebarle'), 'https://www.messenger.com/t/kim.ebarle')
        for bad in ('https://evil.com/t/x', 'https://m.me/', 'https://m.me/a/b'):
            with self.assertRaises(ValidationError):
                rules.clean_messenger_url(bad)

    # TEST 1, 2
    def test_the_directory_shows_each_official_with_their_own_visible_links(self):
        self.assertEqual(self.save(self.ac, {'facebook_profile_url': FB, 'social_links_visibility': True}).status_code, 200)
        self.assertEqual(self.save(self.ac, {'member': self.kag.pk, 'facebook_page_url': 'https://www.facebook.com/SKRafael', 'social_links_visibility': True}).status_code, 200)
        data = next(b for b in self.anon.get('/api/sk-requirements/barangays/').data if b['id'] == self.a.pk)
        chair, kag = self.official(data, 'chairperson'), self.official(data, f'member-{self.kag.pk}')
        self.assertEqual(chair['social']['facebook_profile_url'], FB)  # the chairperson's own link
        self.assertEqual(chair['social']['facebook_page_url'], '')
        self.assertEqual(kag['social']['facebook_page_url'], 'https://www.facebook.com/SKRafael')
        self.assertEqual(kag['social']['facebook_profile_url'], '')  # nothing leaks between officials
        other = next(b for b in self.anon.get('/api/sk-requirements/barangays/').data if b['id'] == self.b.pk)
        self.assertEqual(self.official(other, 'chairperson')['social'], {'visible': False, 'activities': []})

    def test_nothing_is_public_until_it_is_made_visible(self):
        self.save(self.ac, {'facebook_profile_url': FB, 'public_email': 'kim@x.com'})  # visibility not turned on
        data = self.anon.get(f'/api/sk-requirements/barangays/{self.a.pk}/').data
        self.assertEqual(self.official(data, 'chairperson')['social'], {'visible': False, 'activities': []})
        self.assertNotIn(FB, str(data))
        self.assertNotIn('kim@x.com', str(data))
        mine = self.ac.get(f'/api/sk-requirements/barangays/{self.a.pk}/').data  # the manager still sees what is saved
        self.assertEqual(self.official(mine, 'chairperson')['social']['facebook_profile_url'], FB)

    # TEST 3
    def test_an_sk_of_that_barangay_can_update_and_remove_a_link(self):
        self.assertEqual(self.save(self.skc, {'member': self.kag.pk, 'facebook_profile_url': 'https://www.facebook.com/old', 'social_links_visibility': True}).status_code, 200)
        self.assertEqual(self.save(self.skc, {'member': self.kag.pk, 'facebook_profile_url': 'https://www.facebook.com/new'}).status_code, 200)
        data = self.anon.get(f'/api/sk-requirements/barangays/{self.a.pk}/').data
        self.assertEqual(self.official(data, f'member-{self.kag.pk}')['social']['facebook_profile_url'], 'https://www.facebook.com/new')
        self.save(self.skc, {'member': self.kag.pk, 'facebook_profile_url': ''})  # removed
        data = self.anon.get(f'/api/sk-requirements/barangays/{self.a.pk}/').data
        self.assertEqual(self.official(data, f'member-{self.kag.pk}')['social'].get('facebook_profile_url'), '')

    def test_bad_links_and_contacts_are_refused(self):
        for body in ({'facebook_profile_url': 'https://evil.com/x'}, {'messenger_url': 'https://evil.com/t/x'}, {'public_email': 'nope'},
                     {'public_contact_number': 'call me maybe'}):
            r = self.save(self.ac, body)
            self.assertEqual(r.status_code, 400, body)
        self.assertFalse(SKOfficialSocial.objects.exists())

    # TEST 4 is a display rule (no link -> "Facebook profile not provided"); here: no record means no link is sent
    def test_an_official_without_links_has_nothing_to_show(self):
        data = self.anon.get(f'/api/sk-requirements/barangays/{self.a.pk}/').data
        self.assertEqual(self.official(data, f'member-{self.kag.pk}')['social'], {'visible': False, 'activities': []})

    # TEST 5
    def test_a_replacement_does_not_inherit_the_previous_officials_links(self):
        self.save(self.ac, {'member': self.kag.pk, 'facebook_profile_url': 'https://www.facebook.com/rafael', 'social_links_visibility': True})
        self.save(self.ac, {'facebook_profile_url': FB, 'social_links_visibility': True})
        # the kagawad seat is given to someone new (renamed), the chairperson is replaced
        self.ac.post(f'/api/sk-requirements/barangays/{self.a.pk}/official-name/', {'name': 'Brand New Kagawad', 'member': self.kag.pk}, format='json')
        self.ac.patch(f'/api/sk-requirements/barangays/{self.a.pk}/', {'sk_chairperson': 'New Chair'}, format='json')
        data = self.anon.get(f'/api/sk-requirements/barangays/{self.a.pk}/').data
        self.assertEqual(self.official(data, f'member-{self.kag.pk}')['social'], {'visible': False, 'activities': []})
        self.assertEqual(self.official(data, 'chairperson')['social'], {'visible': False, 'activities': []})
        self.assertFalse(SKOfficialSocial.objects.exists())

    def test_removing_an_official_removes_their_links_and_a_typo_fix_keeps_them(self):
        self.save(self.ac, {'member': self.kag.pk, 'facebook_profile_url': 'https://www.facebook.com/rafael'})
        self.ac.post(f'/api/sk-requirements/barangays/{self.a.pk}/official-name/', {'name': 'rafael  AQUINO', 'member': self.kag.pk}, format='json')
        self.assertTrue(SKOfficialSocial.objects.filter(member=self.kag).exists())  # same person, only spacing and case changed
        self.ac.delete(f'/api/sk-requirements/members/{self.kag.pk}/')
        self.assertFalse(SKOfficialSocial.objects.exists())

    # TEST 6
    def test_unauthorised_people_cannot_edit_social_information(self):
        for client in (self.yc, self.anon):
            self.assertIn(self.save(client, {'facebook_profile_url': FB}).status_code, (401, 403))
        # an SK of ANOTHER barangay
        self.assertEqual(self.save(self.skc, {'facebook_profile_url': FB}, barangay=self.b).status_code, 403)
        # an SK whose ID is not verified yet
        IDVerification.objects.filter(user=self.sk).update(status='pending')
        self.skc.force_authenticate(User.objects.get(pk=self.sk.pk))  # a fresh copy of the user
        self.assertEqual(self.save(self.skc, {'facebook_profile_url': FB}).status_code, 403)
        self.assertFalse(SKOfficialSocial.objects.exists())

    def test_a_member_of_another_barangay_cannot_be_reached_through_this_one(self):
        other = SKMember.objects.create(barangay=self.b, position='kagawad', name='Other', order=1)
        self.assertEqual(self.save(self.ac, {'member': other.pk, 'facebook_profile_url': FB}).status_code, 404)

    # TEST 7 + activities
    def test_public_activities_are_manual_links_to_public_facebook_posts(self):
        url = f'/api/sk-requirements/barangays/{self.a.pk}/official-activities/'
        self.assertEqual(self.ac.post(url, {'title': 'Basketball league', 'facebook_post_url': 'https://www.facebook.com/skilayang/posts/123'}, format='json').status_code, 400)  # no social record yet
        self.save(self.ac, {'facebook_page_url': 'https://www.facebook.com/skilayang', 'social_links_visibility': True})
        r = self.ac.post(url, {'title': 'Basketball league', 'facebook_post_url': 'https://www.facebook.com/skilayang/posts/123', 'activity_date': '2026-11-20'}, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(self.ac.post(url, {'title': 'Bad', 'facebook_post_url': 'https://evil.com/p'}, format='json').status_code, 400)
        data = self.anon.get(f'/api/sk-requirements/barangays/{self.a.pk}/').data
        acts = self.official(data, 'chairperson')['social']['activities']
        self.assertEqual([a['title'] for a in acts], ['Basketball league'])
        self.assertEqual(self.yc.post(url, {'title': 'Hack', 'facebook_post_url': 'https://www.facebook.com/x/posts/1'}, format='json').status_code, 403)
        self.ac.delete(url, {'id': acts[0]['id']}, format='json')
        self.assertEqual(self.official(self.anon.get(f'/api/sk-requirements/barangays/{self.a.pk}/').data, 'chairperson')['social']['activities'], [])

    def test_the_messenger_link_is_stored_and_shown(self):
        self.save(self.ac, {'messenger_url': 'm.me/kim.ebarle', 'social_links_visibility': True})
        data = self.anon.get(f'/api/sk-requirements/barangays/{self.a.pk}/').data
        self.assertEqual(self.official(data, 'chairperson')['social']['messenger_url'], 'https://m.me/kim.ebarle')
