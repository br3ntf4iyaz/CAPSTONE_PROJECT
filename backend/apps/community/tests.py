from django.test import TestCase, RequestFactory
from django.contrib.auth import get_user_model
from django.db import IntegrityError
from rest_framework.request import Request
from rest_framework.test import APIClient
from rest_framework import status
from .models import CommunityPost, CommunityPostImage, PostReaction
from .serializers import CommunityPostSerializer

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
        from django.db.models import Count, Exists, OuterRef, Value, BooleanField
        annotated = CommunityPost.objects.annotate(
            like_count=Count('reactions', distinct=True),
            is_liked=Value(False, output_field=BooleanField()),
        ).get(pk=self.post.pk)
        s = CommunityPostSerializer(annotated, context={'request': self.request})
        self.assertEqual(s.data['like_count'], 0)
        self.assertFalse(s.data['is_liked'])

    def test_serializer_has_is_pinned(self):
        s = CommunityPostSerializer(self.post, context={'request': self.request})
        self.assertFalse(s.data['is_pinned'])

    def test_serializer_no_image_url_field(self):
        s = CommunityPostSerializer(self.post, context={'request': self.request})
        self.assertNotIn('image_url', s.data)


class CommunityPostViewSetTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email='api@example.com', password='pass', role='youth',
            is_email_verified=True,
        )
        self.admin = User.objects.create_user(
            email='admin@example.com', password='pass', role='lgu_admin',
            is_email_verified=True,
        )
        self.post = CommunityPost.objects.create(
            author=self.user, content='API test post'
        )

    def test_list_returns_posts_with_images_and_like_count(self):
        self.client.force_authenticate(self.user)
        r = self.client.get('/api/community/posts/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        results = r.data.get('results', r.data)
        post_data = next(p for p in results if p['id'] == self.post.id)
        self.assertIn('images', post_data)
        self.assertIn('like_count', post_data)
        self.assertIn('is_liked', post_data)

    def test_react_toggles_like(self):
        self.client.force_authenticate(self.user)
        r = self.client.post(f'/api/community/posts/{self.post.id}/react/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertTrue(r.data['liked'])
        self.assertEqual(r.data['count'], 1)
        # Toggle off
        r2 = self.client.post(f'/api/community/posts/{self.post.id}/react/')
        self.assertFalse(r2.data['liked'])
        self.assertEqual(r2.data['count'], 0)

    def test_pin_requires_admin(self):
        self.client.force_authenticate(self.user)
        r = self.client.post(f'/api/community/posts/{self.post.id}/pin/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_pin_sets_pinned_flag(self):
        self.client.force_authenticate(self.admin)
        r = self.client.post(f'/api/community/posts/{self.post.id}/pin/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertTrue(r.data['is_pinned'])
        self.post.refresh_from_db()
        self.assertTrue(self.post.is_pinned)

    def test_pin_unpins_previous(self):
        other = CommunityPost.objects.create(author=self.user, content='other')
        other.is_pinned = True
        other.save()
        self.client.force_authenticate(self.admin)
        self.client.post(f'/api/community/posts/{self.post.id}/pin/')
        other.refresh_from_db()
        self.assertFalse(other.is_pinned)

    def test_pinned_post_appears_first(self):
        self.post.is_pinned = True
        self.post.save()
        newer = CommunityPost.objects.create(author=self.user, content='newer')
        self.client.force_authenticate(self.user)
        r = self.client.get('/api/community/posts/')
        results = r.data.get('results', r.data)
        self.assertEqual(results[0]['id'], self.post.id)

    def test_barangay_filter(self):
        self.client.force_authenticate(self.user)
        r = self.client.get('/api/community/posts/?barangay=Ibabang Dupay')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
