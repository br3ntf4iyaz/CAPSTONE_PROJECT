from datetime import timedelta

from django.core.management import call_command
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.events.models import Event
from apps.jobs.models import JobOpportunity as Job
from apps.notifications.models import Notification


class EventReminderTests(APITestCase):
    def setUp(self):
        self.a = User.objects.create_user(email='a@x.com', password='p', role='youth', is_active=True)
        self.b = User.objects.create_user(email='b@x.com', password='p', role='youth', is_active=True)
        self.off = User.objects.create_user(email='off@x.com', password='p', role='youth', is_active=False)
        self.admin = User.objects.create_user(email='ad@x.com', password='p', role='lgu_admin', is_active=True)

    def event(self, **kw):
        base = dict(title='Youth Summit', description='d', location='City Hall', start_datetime=timezone.now() + timedelta(days=10),
                    end_datetime=timezone.now() + timedelta(days=10, hours=2), is_published=True, is_active=True)
        base.update(kw)
        return Event.objects.create(**base)

    def test_a_new_published_event_is_announced_to_every_active_young_user_once(self):
        ev = self.event()
        self.assertEqual(Notification.objects.filter(title='New event: Youth Summit').count(), 2)
        self.assertFalse(Notification.objects.filter(user=self.off).exists())
        self.assertFalse(Notification.objects.filter(user=self.admin).exists())
        ev.title = 'Youth Summit 2'
        ev.save()  # editing it again must not announce it again
        self.assertEqual(Notification.objects.filter(notification_type='event').count(), 2)

    def test_draft_and_past_events_are_not_announced(self):
        self.event(is_published=False)
        self.event(start_datetime=timezone.now() - timedelta(days=1), end_datetime=timezone.now() - timedelta(hours=20))
        self.assertEqual(Notification.objects.count(), 0)

    def test_a_draft_that_is_published_later_is_announced_then(self):
        ev = self.event(is_published=False)
        ev.is_published = True
        ev.save()
        self.assertEqual(Notification.objects.filter(user=self.a).count(), 1)

    def test_reminders_for_near_events_are_sent_once_even_when_the_command_runs_often(self):
        self.event(title='Near', start_datetime=timezone.now() + timedelta(days=2), end_datetime=timezone.now() + timedelta(days=2, hours=1))
        self.event(title='Tomorrow', start_datetime=timezone.now() + timedelta(hours=20), end_datetime=timezone.now() + timedelta(hours=22))
        self.event(title='Far')
        Notification.objects.all().delete()  # forget the "new event" notices, to look at reminders alone
        for _ in range(3):
            call_command('send_event_reminders')
        titles = sorted(Notification.objects.filter(user=self.a).values_list('title', flat=True))
        self.assertEqual(titles, ['Coming up: Near', 'Tomorrow: Tomorrow'])

    def test_jobs_closing_soon_are_announced_once(self):
        Job.objects.create(title='Clerk', company_or_org='LGU', location='Lucena', job_type='full_time', industry='other', description='d', is_active=True,
                           application_deadline=timezone.localdate() + timedelta(days=2))
        call_command('send_event_reminders')
        call_command('send_event_reminders')
        self.assertEqual(Notification.objects.filter(user=self.b, title='Closing soon: Clerk').count(), 1)
