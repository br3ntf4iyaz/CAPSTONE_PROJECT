from rest_framework.test import APITestCase

from apps.accounts.models import User
from .models import BroadcastNotification, Notification


class DeleteNotificationTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email='a@x.com', password='p', role='youth', is_active=True)
        self.other = User.objects.create_user(email='b@x.com', password='p', role='youth', is_active=True)
        self.mine = [Notification.objects.create(user=self.user, title=f'n{i}', message='m', notification_type='event') for i in range(3)]
        self.theirs = Notification.objects.create(user=self.other, title='theirs', message='m', notification_type='event')
        self.announcement = Notification.objects.create(user=self.user, title='ann', message='m', notification_type='announcement')

    def url(self, n):
        return f'/api/notifications/{n.id}/'

    def test_deletes_only_the_selected_one(self):
        self.client.force_authenticate(self.user)
        r = self.client.delete(self.url(self.mine[0]))
        self.assertEqual(r.status_code, 204)
        self.assertFalse(Notification.objects.filter(id=self.mine[0].id).exists())
        # the other four of mine and the other user's one stay, and keep their read state
        self.assertEqual(Notification.objects.filter(user=self.user).count(), 3)
        self.assertTrue(Notification.objects.filter(id=self.theirs.id).exists())
        self.assertEqual(Notification.objects.filter(user=self.user, is_read=True).count(), 0)

    def test_persists_after_reload(self):
        self.client.force_authenticate(self.user)
        self.client.delete(self.url(self.mine[1]))
        ids = [n['id'] for n in self.client.get('/api/notifications/?page_size=50').data['results']]
        self.assertNotIn(self.mine[1].id, ids)

    def test_cannot_delete_someone_elses(self):
        self.client.force_authenticate(self.user)
        r = self.client.delete(self.url(self.theirs))
        self.assertEqual(r.status_code, 404)
        self.assertTrue(Notification.objects.filter(id=self.theirs.id).exists())

    def test_requires_login(self):
        r = self.client.delete(self.url(self.mine[0]))
        self.assertIn(r.status_code, (401, 403))
        self.assertTrue(Notification.objects.filter(id=self.mine[0].id).exists())

    def test_messages_tab_is_protected(self):
        BroadcastNotification.objects.create(title='b', message='m', target_audience='all')
        self.client.force_authenticate(self.user)
        r = self.client.delete(self.url(self.announcement))
        self.assertEqual(r.status_code, 400)
        self.assertTrue(Notification.objects.filter(id=self.announcement.id).exists())
        self.assertEqual(BroadcastNotification.objects.count(), 1)

    def test_unread_count_follows(self):
        self.client.force_authenticate(self.user)
        before = self.client.get('/api/notifications/unread_count/').data['count']
        self.client.delete(self.url(self.mine[0]))
        self.assertEqual(self.client.get('/api/notifications/unread_count/').data['count'], before - 1)

    def test_other_methods_still_blocked(self):
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.put(self.url(self.mine[0]), {'title': 'x'}).status_code, 405)
        self.assertEqual(self.client.patch(self.url(self.mine[0]), {'title': 'x'}).status_code, 405)


class AdminDeleteNotificationTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(email='ad@x.com', password='p', role='lgu_admin', is_active=True)
        self.other_admin = User.objects.create_user(email='ad2@x.com', password='p', role='lgu_admin', is_active=True)
        self.note = Notification.objects.create(user=self.admin, title='New event registration', message='m', notification_type='system', link='/admin/calendar?event=1')
        self.theirs = Notification.objects.create(user=self.other_admin, title='x', message='m', notification_type='system')

    def test_an_admin_deletes_only_their_own_notification(self):
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.delete(f'/api/notifications/{self.theirs.id}/').status_code, 404)
        self.assertEqual(self.client.delete(f'/api/notifications/{self.note.id}/').status_code, 204)
        self.assertFalse(Notification.objects.filter(id=self.note.id).exists())
        self.assertTrue(Notification.objects.filter(id=self.theirs.id).exists())
