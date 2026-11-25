from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.notifications.models import Notification
from .models import CommunityComment, CommunityPost, PostReaction


def make_user(email, first, youth_type='general_youth', role='youth'):
    return User.objects.create_user(email=email, password='p', role=role, first_name=first, last_name='T',
                                    youth_type=youth_type, is_active=True, is_email_verified=True)


class ReactionTests(APITestCase):
    def setUp(self):
        self.a = make_user('a@x.com', 'Alice')
        self.b = make_user('b@x.com', 'Bob')
        self.c = make_user('c@x.com', 'Carl', 'sk')
        self.post = CommunityPost.objects.create(author=self.a, content='hello')
        self.url = f'/api/community/posts/{self.post.id}/react/'

    def react(self, user, kind=None):
        self.client.force_authenticate(user)
        return self.client.post(self.url, {'reaction': kind} if kind else {}, format='json')

    def test_all_seven_reactions_are_saved(self):
        for kind in ('like', 'love', 'care', 'haha', 'wow', 'sad', 'angry'):
            PostReaction.objects.filter(post=self.post).delete()
            r = self.react(self.b, kind)
            self.assertEqual(r.status_code, 200)
            self.assertEqual(r.data['reaction'], kind)
            self.assertEqual(PostReaction.objects.get(post=self.post, user=self.b).reaction_type, kind)

    def test_unknown_reaction_is_rejected(self):
        self.assertEqual(self.react(self.b, 'meh').status_code, 400)
        self.assertEqual(PostReaction.objects.count(), 0)

    def test_changing_updates_the_same_row_and_same_again_removes(self):
        self.react(self.b, 'love')
        r = self.react(self.b, 'haha')
        self.assertEqual(r.data['reaction'], 'haha')
        self.assertEqual(PostReaction.objects.filter(post=self.post, user=self.b).count(), 1)
        self.assertEqual(r.data['count'], 1)
        r = self.react(self.b, 'haha')
        self.assertIsNone(r.data['reaction'])
        self.assertEqual(PostReaction.objects.count(), 0)

    def test_post_shows_my_reaction_and_summary_after_reload(self):
        self.react(self.b, 'love')
        self.react(self.c, 'love')
        self.react(self.a, 'wow')
        self.client.force_authenticate(self.b)
        data = [p for p in self.client.get('/api/community/posts/').data['results'] if p['id'] == self.post.id][0]
        self.assertEqual(data['my_reaction'], 'love')
        self.assertEqual(data['like_count'], 3)
        self.assertEqual(data['reaction_summary'][0], {'type': 'love', 'count': 2})
        self.assertEqual({s['type'] for s in data['reaction_summary']}, {'love', 'wow'})

    def test_notification_wording_follows_the_reaction(self):
        for kind, text in (('love', 'Bob T loved your post.'), ('care', 'Bob T cared about your post.'),
                           ('haha', 'Bob T laughed at your post.'), ('wow', 'Bob T reacted with Wow to your post.')):
            Notification.objects.all().delete()
            PostReaction.objects.all().delete()
            self.react(self.b, kind)
            n = Notification.objects.get(user=self.a)
            self.assertEqual(n.title, text)
            self.assertEqual(n.reaction_type, kind)

    def test_changing_reaction_does_not_add_a_notification_or_unread(self):
        self.react(self.b, 'love')
        n = Notification.objects.get(user=self.a)
        n.is_read = True
        n.save()
        self.react(self.b, 'sad')
        self.assertEqual(Notification.objects.filter(user=self.a).count(), 1)
        n.refresh_from_db()
        self.assertTrue(n.is_read)
        self.assertEqual(n.title, 'Bob T reacted with Sad to your post.')

    def test_reactors_filter_data_has_each_reaction(self):
        self.react(self.b, 'love')
        self.react(self.c, 'angry')
        self.client.force_authenticate(self.a)
        res = self.client.get(f'/api/community/posts/{self.post.id}/reactors/').data['results']
        self.assertEqual({p['name']: p['reaction'] for p in res}, {'Bob T': 'love', 'Carl T': 'angry'})


class CommentManagementTests(APITestCase):
    def setUp(self):
        self.owner = make_user('o@x.com', 'Owner')
        self.b = make_user('b@x.com', 'Bob')
        self.c = make_user('c@x.com', 'Carl')
        self.admin = make_user('ad@x.com', 'Admin', role='lgu_admin')
        self.post = CommunityPost.objects.create(author=self.owner, content='hi')
        self.base = f'/api/community/posts/{self.post.id}/comments/'

    def say(self, user, text, parent=None):
        self.client.force_authenticate(user)
        return self.client.post(self.base, {'content': text, **({'parent': parent} if parent else {})}, format='json')

    def listing(self, user):
        self.client.force_authenticate(user)
        return self.client.get(self.base).data

    # replies
    def test_reply_notifies_the_comment_author(self):
        first = self.say(self.b, 'first').data['id']
        self.say(self.c, 'a reply', parent=first)
        n = Notification.objects.get(user=self.b, notification_type='community_reply')
        self.assertEqual(n.title, 'Carl T replied to your comment.')
        self.assertEqual(n.message, 'a reply')
        self.assertIn(f'comment={n.comment_id}', n.link)
        # the post owner still hears about the new comment
        self.assertTrue(Notification.objects.filter(user=self.owner, notification_type='community_comment').exists())

    def test_replying_to_yourself_does_not_notify(self):
        first = self.say(self.b, 'first').data['id']
        self.say(self.b, 'again', parent=first)
        self.assertFalse(Notification.objects.filter(user=self.b, notification_type='community_reply').exists())

    def test_reply_to_the_post_owners_comment_gives_one_notification(self):
        first = self.say(self.owner, 'mine').data['id']
        self.say(self.b, 'reply', parent=first)
        self.assertEqual(Notification.objects.filter(user=self.owner).count(), 1)

    # delete
    def test_author_deletes_only_their_comment(self):
        a = self.say(self.b, 'one').data['id']
        self.say(self.b, 'two')
        self.client.force_authenticate(self.b)
        self.assertEqual(self.client.delete(f'{self.base}{a}/').status_code, 204)
        self.assertEqual(CommunityComment.objects.count(), 1)
        self.assertTrue(CommunityPost.objects.filter(id=self.post.id).exists())

    def test_strangers_cannot_delete_it(self):
        a = self.say(self.b, 'one').data['id']
        self.client.force_authenticate(self.c)
        self.assertEqual(self.client.delete(f'{self.base}{a}/').status_code, 403)
        self.assertEqual(CommunityComment.objects.count(), 1)

    def test_post_owner_can_delete_anyones_comment_on_their_post(self):
        a = self.say(self.b, 'sensitive').data['id']
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.delete(f'{self.base}{a}/').status_code, 204)
        self.assertEqual(CommunityComment.objects.count(), 0)
        self.assertTrue(CommunityPost.objects.filter(id=self.post.id).exists())

    def test_post_owner_cannot_delete_comments_on_someone_elses_post(self):
        other = CommunityPost.objects.create(author=self.c, content='not mine')
        self.client.force_authenticate(self.b)
        made = self.client.post(f'/api/community/posts/{other.id}/comments/', {'content': 'hi'}, format='json').data['id']
        self.client.force_authenticate(self.owner)  # owner of a different post
        self.assertEqual(self.client.delete(f'/api/community/posts/{other.id}/comments/{made}/').status_code, 403)

    def test_admin_can_delete(self):
        a = self.say(self.b, 'one').data['id']
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.delete(f'{self.base}{a}/').status_code, 204)

    def test_deleting_a_comment_with_replies_keeps_the_thread(self):
        a = self.say(self.b, 'parent').data['id']
        self.say(self.c, 'child', parent=a)
        self.client.force_authenticate(self.b)
        self.client.delete(f'{self.base}{a}/')
        parent = CommunityComment.objects.get(id=a)
        self.assertTrue(parent.is_deleted)
        self.assertEqual(parent.content, '')
        self.assertEqual(CommunityComment.objects.count(), 2)

    # hide
    def test_owner_hides_and_restores(self):
        a = self.say(self.b, 'rude').data['id']
        self.client.force_authenticate(self.owner)
        r = self.client.post(f'{self.base}{a}/hide/')
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data['is_hidden'])
        self.assertEqual(r.data['hidden_label'], 'Hidden by post owner')
        c = CommunityComment.objects.get(id=a)
        self.assertEqual(c.hidden_by, self.owner)
        self.assertIsNotNone(c.hidden_at)
        # kept in the database, gone from the public view, still visible to the owner
        self.assertEqual([x['id'] for x in self.listing(self.c)], [])
        self.assertEqual([x['id'] for x in self.listing(self.b)], [])
        self.assertEqual([x['id'] for x in self.listing(self.owner)], [a])
        self.client.force_authenticate(self.owner)
        self.assertFalse(self.client.post(f'{self.base}{a}/restore/').data['is_hidden'])
        self.assertEqual([x['id'] for x in self.listing(self.c)], [a])

    def test_author_cannot_unhide_and_strangers_cannot_hide(self):
        a = self.say(self.b, 'x').data['id']
        self.client.force_authenticate(self.owner)
        self.client.post(f'{self.base}{a}/hide/')
        self.client.force_authenticate(self.b)
        self.assertEqual(self.client.post(f'{self.base}{a}/restore/').status_code, 403)
        self.client.force_authenticate(self.c)
        self.assertEqual(self.client.post(f'{self.base}{a}/hide/').status_code, 403)
        self.assertTrue(CommunityComment.objects.get(id=a).is_hidden)

    def test_comment_count_ignores_hidden_ones(self):
        a = self.say(self.b, 'one').data['id']
        self.say(self.c, 'two')
        self.client.force_authenticate(self.owner)
        before = self.client.get('/api/community/posts/').data['results'][0]['comment_count']
        self.client.post(f'{self.base}{a}/hide/')
        after = self.client.get('/api/community/posts/').data['results'][0]['comment_count']
        self.assertEqual((before, after), (2, 1))

    def test_permission_flags_in_the_list(self):
        self.say(self.b, 'bob says')
        mine = self.listing(self.b)[0]
        self.assertTrue(mine['can_delete'])
        self.assertFalse(mine['can_hide'])
        owner_view = self.listing(self.owner)[0]
        self.assertTrue(owner_view['can_hide'])
        self.assertTrue(owner_view['can_delete'])
        stranger = self.listing(self.c)[0]
        self.assertFalse(stranger['can_delete'])
        self.assertFalse(stranger['can_hide'])
