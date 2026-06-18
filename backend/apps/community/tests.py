from django.test import TestCase
from django.contrib.auth import get_user_model
from .models import CommunityPost, CommunityPostImage, PostReaction

User = get_user_model()


class CommunityModelsTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='test@example.com', password='pass', role='youth'
        )
        self.post = CommunityPost.objects.create(
            author=self.user, content='Hello'
        )

    def test_community_post_image_model(self):
        img = CommunityPostImage.objects.create(post=self.post, order=0)
        self.assertEqual(img.post, self.post)
        self.assertEqual(img.order, 0)

    def test_post_reaction_unique_together(self):
        PostReaction.objects.create(post=self.post, user=self.user)
        with self.assertRaises(Exception):
            PostReaction.objects.create(post=self.post, user=self.user)

    def test_community_post_is_pinned_default_false(self):
        self.assertFalse(self.post.is_pinned)
