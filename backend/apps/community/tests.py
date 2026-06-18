from django.test import TestCase
from django.contrib.auth import get_user_model
from django.db import IntegrityError
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
        with self.assertRaises(IntegrityError):
            PostReaction.objects.create(post=self.post, user=self.user)

    def test_community_post_is_pinned_default_false(self):
        self.assertFalse(self.post.is_pinned)


from django.test import RequestFactory
from rest_framework.request import Request
from .serializers import CommunityPostSerializer


class CommunityPostSerializerTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='ser@example.com', password='pass', role='youth'
        )
        self.post = CommunityPost.objects.create(
            author=self.user, content='Test'
        )
        factory = RequestFactory()
        django_request = factory.get('/')
        django_request.user = self.user
        self.request = Request(django_request)

    def test_serializer_has_images_field(self):
        s = CommunityPostSerializer(self.post, context={'request': self.request})
        self.assertIn('images', s.data)
        self.assertEqual(s.data['images'], [])

    def test_serializer_has_like_count_and_is_liked(self):
        s = CommunityPostSerializer(self.post, context={'request': self.request})
        self.assertEqual(s.data['like_count'], 0)
        self.assertFalse(s.data['is_liked'])

    def test_serializer_has_is_pinned(self):
        s = CommunityPostSerializer(self.post, context={'request': self.request})
        self.assertFalse(s.data['is_pinned'])

    def test_serializer_no_image_url_field(self):
        s = CommunityPostSerializer(self.post, context={'request': self.request})
        self.assertNotIn('image_url', s.data)
