from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.notifications.models import Notification
from apps.verification.models import IDVerification

from .models import Event, EventRegistration

User = get_user_model()


class RegistrationNoticeTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(email='ad@t.local', password='x', role='lgu_admin', is_active=True)
        self.sk = User.objects.create_user(email='sk@t.local', password='x', first_name='Sky', last_name='Kay', role='youth', youth_type='sk', is_active=True)
        IDVerification.objects.create(user=self.sk, id_type='umid', status='approved')
        start = timezone.now() + timedelta(days=5)
        self.event = Event.objects.create(title='SK Training', description='d', start_datetime=start, end_datetime=start + timedelta(hours=3),
                                          capacity=50, is_published=True)
        self.c = APIClient()
        self.c.force_authenticate(self.sk)
        self.url = f'/api/events/{self.event.pk}/register/'

    def test_registering_tells_the_person_and_lydo_with_a_link_to_the_list(self):
        self.assertEqual(self.c.post(self.url).status_code, 201)
        mine = Notification.objects.get(user=self.sk, title='Event registration confirmed')
        self.assertIn('SK Training', mine.message)
        note = Notification.objects.get(user=self.admin, title='New event registration')
        self.assertIn('Sky Kay', note.message)
        self.assertIn('1/50', note.message)
        self.assertEqual(note.link, f'/admin/calendar?event={self.event.pk}')

    def test_nothing_is_sent_when_the_registration_is_refused(self):
        self.c.post(self.url)
        Notification.objects.all().delete()
        self.assertEqual(self.c.post(self.url).status_code, 400)  # already registered
        unverified = User.objects.create_user(email='u@t.local', password='x', role='youth', is_active=True)
        c2 = APIClient()
        c2.force_authenticate(unverified)
        self.assertEqual(c2.post(self.url).status_code, 403)
        self.assertFalse(Notification.objects.exists())

    def test_cancelling_is_told_too(self):
        self.c.post(self.url)
        self.assertEqual(self.c.post(f'/api/events/{self.event.pk}/unregister/').status_code, 200)
        self.assertTrue(Notification.objects.filter(user=self.sk, title='Event registration cancelled').exists())
        self.assertTrue(Notification.objects.filter(user=self.admin, title='Event registration cancelled').exists())
        self.assertFalse(EventRegistration.objects.exists())

    def test_the_admin_sees_who_registered_and_others_do_not(self):
        self.c.post(self.url)
        adm = APIClient()
        adm.force_authenticate(self.admin)
        rows = adm.get(f'/api/events/{self.event.pk}/attendance/').data
        self.assertEqual(len(rows), 1)
        self.assertEqual(self.c.get(f'/api/events/{self.event.pk}/attendance/').status_code, 403)
