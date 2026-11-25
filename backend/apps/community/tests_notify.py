from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.notifications.models import Notification
from .models import CommunityPost, CommunityPostImage, PostReaction


def make_user(email, first, youth_type='general_youth'):
    return User.objects.create_user(email=email, password='p', role='youth', first_name=first, last_name='Test',
                                    youth_type=youth_type, is_active=True, is_email_verified=True)


class CommunityNotificationTests(APITestCase):
    def setUp(self):
        self.a = make_user('a@x.com', 'Alice')
        self.b = make_user('b@x.com', 'Bob')
        self.c = make_user('c@x.com', 'Carl', 'sk')
        self.d = make_user('d@x.com', 'Dina', 'youth_org_leader')
        self.post = CommunityPost.objects.create(author=self.a, content='hello')

    def act(self, user):
        self.client.force_authenticate(user)
        return self.client

    def notes(self, kind=None):
        qs = Notification.objects.filter(user=self.a)
        return qs.filter(notification_type=kind) if kind else qs

    # A / comments
    def test_comment_notifies_owner_with_preview_and_link(self):
        r = self.act(self.b).post(f'/api/community/posts/{self.post.id}/comments/', {'content': 'Nice one'}, format='json')
        self.assertEqual(r.status_code, 201)
        n = self.notes('community_comment').get()
        self.assertEqual(n.title, 'Bob Test commented on your post.')
        self.assertEqual(n.message, 'Nice one')
        self.assertEqual(n.actor, self.b)
        self.assertEqual(n.post_id, self.post.id)
        self.assertIn(f'post={self.post.id}', n.link)
        self.assertIn('comment=', n.link)

    def test_comment_on_a_photo_says_photo(self):
        CommunityPostImage.objects.create(post=self.post, image=SimpleUploadedFile('a.png', b'x'), order=0)
        self.act(self.b).post(f'/api/community/posts/{self.post.id}/comments/', {'content': 'wow'}, format='json')
        self.assertEqual(self.notes('community_comment').get().title, 'Bob Test commented on your photo.')

    def test_own_comment_does_not_notify(self):
        self.act(self.a).post(f'/api/community/posts/{self.post.id}/comments/', {'content': 'me'}, format='json')
        self.assertEqual(self.notes().count(), 0)

    def test_double_submit_is_not_duplicated(self):
        for _ in range(2):
            self.act(self.b).post(f'/api/community/posts/{self.post.id}/comments/', {'content': 'same'}, format='json')
        self.assertEqual(self.notes('community_comment').count(), 1)

    def test_deleting_comment_removes_its_notification(self):
        r = self.act(self.b).post(f'/api/community/posts/{self.post.id}/comments/', {'content': 'oops'}, format='json')
        self.client.delete(f'/api/community/posts/{self.post.id}/comments/{r.data["id"]}/')
        self.assertEqual(self.notes('community_comment').count(), 0)

    # B / C / F reactions
    def test_reaction_notifies_owner(self):
        self.act(self.b).post(f'/api/community/posts/{self.post.id}/react/')
        n = self.notes('community_reaction').get()
        self.assertEqual(n.title, 'Bob Test liked your post.')
        self.assertEqual(n.actor, self.b)

    def test_own_reaction_does_not_notify(self):
        self.act(self.a).post(f'/api/community/posts/{self.post.id}/react/')
        self.assertEqual(self.notes().count(), 0)

    def test_reactions_are_grouped_into_one_notification(self):
        for u in (self.b, self.c, self.d):
            self.act(u).post(f'/api/community/posts/{self.post.id}/react/')
        n = self.notes('community_reaction').get()
        self.assertEqual(n.title, 'Dina Test, Carl Test and 1 other reacted to your post.')
        other = CommunityPost.objects.create(author=self.a, content='second')
        self.act(self.b).post(f'/api/community/posts/{other.id}/react/')
        self.assertEqual(self.notes('community_reaction').count(), 2)  # unrelated posts are not merged

    def test_new_reaction_makes_group_unread_again(self):
        self.act(self.b).post(f'/api/community/posts/{self.post.id}/react/')
        n = self.notes('community_reaction').get()
        n.is_read = True
        n.save()
        self.act(self.c).post(f'/api/community/posts/{self.post.id}/react/')
        n.refresh_from_db()
        self.assertFalse(n.is_read)

    def test_removing_a_reaction_updates_quietly_and_never_notifies(self):
        for u in (self.b, self.c):
            self.act(u).post(f'/api/community/posts/{self.post.id}/react/')
        n = self.notes('community_reaction').get()
        n.is_read = True
        n.save()
        self.act(self.c).post(f'/api/community/posts/{self.post.id}/react/')  # c removes
        n.refresh_from_db()
        self.assertTrue(n.is_read)
        self.assertEqual(n.title, 'Bob Test liked your post.')
        self.act(self.b).post(f'/api/community/posts/{self.post.id}/react/')  # last one removes
        self.assertEqual(self.notes('community_reaction').count(), 0)

    def test_deleted_notification_is_not_recreated_by_a_refresh(self):
        self.act(self.b).post(f'/api/community/posts/{self.post.id}/react/')
        n = self.notes('community_reaction').get()
        self.act(self.a).delete(f'/api/notifications/{n.id}/')
        self.client.get('/api/notifications/')
        self.client.get('/api/community/posts/')
        self.assertEqual(self.notes('community_reaction').count(), 0)

    # D / reactors list
    def test_reactors_list_matches_the_database(self):
        for u in (self.b, self.c, self.d):
            self.act(u).post(f'/api/community/posts/{self.post.id}/react/')
        r = self.act(self.a).get(f'/api/community/posts/{self.post.id}/reactors/')
        self.assertEqual(r.data['count'], 3)
        self.assertEqual(r.data['count'], PostReaction.objects.filter(post=self.post).count())
        types = {p['name']: p['account_type'] for p in r.data['results']}
        self.assertEqual(types, {'Bob Test': 'General Youth', 'Carl Test': 'SK Official', 'Dina Test': 'Youth Organization Leader'})
        self.assertNotIn('email', r.data['results'][0])
        self.act(self.b).post(f'/api/community/posts/{self.post.id}/react/')  # b removes
        r = self.client.get(f'/api/community/posts/{self.post.id}/reactors/')
        self.assertEqual(r.data['count'], 2)
        self.assertNotIn('Bob Test', [p['name'] for p in r.data['results']])

    def test_reactors_needs_login(self):
        self.client.force_authenticate(None)
        self.assertIn(self.client.get(f'/api/community/posts/{self.post.id}/reactors/').status_code, (401, 403))

    # edge: deleted post
    def test_deleting_the_post_removes_its_notifications(self):
        self.act(self.b).post(f'/api/community/posts/{self.post.id}/react/')
        self.client.post(f'/api/community/posts/{self.post.id}/comments/', {'content': 'hi'}, format='json')
        self.assertEqual(self.notes().count(), 2)
        self.act(self.a).delete(f'/api/community/posts/{self.post.id}/')
        self.assertEqual(self.notes().count(), 0)

    # G / isolation
    def test_only_the_owner_sees_the_notification(self):
        self.act(self.b).post(f'/api/community/posts/{self.post.id}/react/')
        n = self.notes('community_reaction').get()
        self.assertEqual(self.act(self.b).get('/api/notifications/').data['count'], 0)
        self.assertEqual(self.client.get(f'/api/notifications/{n.id}/').status_code, 404)
        self.assertEqual(self.client.post(f'/api/notifications/{n.id}/mark_read/').status_code, 404)
        self.assertEqual(self.client.delete(f'/api/notifications/{n.id}/').status_code, 404)
        self.assertTrue(Notification.objects.filter(id=n.id).exists())

    def test_owner_notifications_expose_the_actor(self):
        self.act(self.b).post(f'/api/community/posts/{self.post.id}/react/')
        data = self.act(self.a).get('/api/notifications/').data['results'][0]
        self.assertEqual(data['actor_name'], 'Bob Test')
        self.assertEqual(data['post_id'], self.post.id)
