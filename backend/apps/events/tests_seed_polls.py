from django.core.management import call_command
from django.core.management.base import CommandError
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.events.models import Poll


class SeedPollsTests(APITestCase):
    def test_needs_an_admin(self):
        with self.assertRaises(CommandError):
            call_command('seed_polls')

    def test_adds_polls_once_with_options_and_they_are_listed_for_youth(self):
        User.objects.create_user(email='ad@x.com', password='p', role='lgu_admin', is_active=True)
        youth = User.objects.create_user(email='y@x.com', password='p', role='youth', is_active=True)
        call_command('seed_polls')
        n = Poll.objects.count()
        self.assertGreaterEqual(n, 10)
        call_command('seed_polls')
        self.assertEqual(Poll.objects.count(), n)  # running it again adds nothing
        for p in Poll.objects.all():
            self.assertGreaterEqual(p.options.count(), 3)
        self.client.force_authenticate(youth)
        r = self.client.get('/api/events/polls/')
        self.assertEqual(r.status_code, 200)
