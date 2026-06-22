# Community Feed Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Instagram-style multi-photo posts, heart reactions, infinite scroll, pinned announcements, and barangay filter chips to the community feed.

**Architecture:** Three new backend models (`CommunityPostImage`, `PostReaction`, `is_pinned` field on `CommunityPost`) with DRF custom actions; frontend replaces `useQuery` with `useInfiniteQuery`, adds an `IntersectionObserver` sentinel, a `PhotoGrid` subcomponent, and optimistic like toggling.

**Tech Stack:** Django 5 + DRF, React + TypeScript, TanStack React Query v5, Tailwind CSS, Lucide React icons.

---

## File Map

| File | Change |
|------|--------|
| `backend/apps/community/models.py` | Add `CommunityPostImage`, `PostReaction`; add `is_pinned` to `CommunityPost` |
| `backend/apps/community/migrations/0002_…` | Auto-generated — `CommunityPostImage` |
| `backend/apps/community/migrations/0003_…` | Auto-generated — `PostReaction` |
| `backend/apps/community/migrations/0004_…` | Auto-generated — `is_pinned` |
| `backend/apps/community/serializers.py` | Add `CommunityPostImageSerializer`; update `CommunityPostSerializer` |
| `backend/apps/community/views.py` | `perform_create`, `react`, `pin` actions; updated `get_queryset` |
| `backend/apps/community/tests.py` | New — all backend API tests |
| `frontend/src/api/community.ts` | Updated types + `list`, `react`, `pin` methods |
| `frontend/src/portals/youth/pages/hubs/CommunityHubPage.tsx` | All UI changes |

---

## Task 1: Add CommunityPostImage and PostReaction models + is_pinned field

**Files:**
- Modify: `backend/apps/community/models.py`
- Create: `backend/apps/community/tests.py`

- [ ] **Step 1: Write failing tests**

Create `backend/apps/community/tests.py`:

```python
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
```

- [ ] **Step 2: Run tests — expect failure**

```bash
cd backend
venv/Scripts/python.exe manage.py test apps.community -v 2
```

Expected: `ImportError: cannot import name 'CommunityPostImage'`

- [ ] **Step 3: Add models**

Replace full contents of `backend/apps/community/models.py`:

```python
from django.db import models
from django.conf import settings


class CommunityPost(models.Model):
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='community_posts',
    )
    content = models.TextField(max_length=2000)
    image = models.ImageField(upload_to='community_posts/', null=True, blank=True)
    is_pinned = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.author} — {self.created_at:%Y-%m-%d}"


class CommunityPostImage(models.Model):
    post = models.ForeignKey(
        CommunityPost, on_delete=models.CASCADE, related_name='images'
    )
    image = models.ImageField(upload_to='community_posts/')
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['order']


class PostReaction(models.Model):
    post = models.ForeignKey(
        CommunityPost, on_delete=models.CASCADE, related_name='reactions'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('post', 'user')]
```

- [ ] **Step 4: Generate and run migrations**

```bash
cd backend
venv/Scripts/python.exe manage.py makemigrations community
venv/Scripts/python.exe manage.py migrate
```

Expected output: one combined migration file created (e.g. `0002_communitypost_is_pinned_communitypostimage_postreaction.py`), applied successfully.

- [ ] **Step 5: Run tests — expect pass**

```bash
cd backend
venv/Scripts/python.exe manage.py test apps.community -v 2
```

Expected: `Ran 3 tests ... OK`

- [ ] **Step 6: Commit**

```bash
git add backend/apps/community/models.py backend/apps/community/migrations/ backend/apps/community/tests.py
git commit -m "feat(community): add CommunityPostImage, PostReaction models; is_pinned field"
```

---

## Task 2: Update serializers

**Files:**
- Modify: `backend/apps/community/serializers.py`
- Modify: `backend/apps/community/tests.py`

- [ ] **Step 1: Add serializer tests**

Append to `backend/apps/community/tests.py`:

```python
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
```

- [ ] **Step 2: Run tests — expect failure**

```bash
cd backend
venv/Scripts/python.exe manage.py test apps.community.tests.CommunityPostSerializerTest -v 2
```

Expected: `AssertionError: 'images' not found in ...`

- [ ] **Step 3: Rewrite serializers**

Replace full contents of `backend/apps/community/serializers.py`:

```python
from rest_framework import serializers
from .models import CommunityPost, CommunityPostImage


class CommunityPostImageSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = CommunityPostImage
        fields = ['id', 'url', 'order']

    def get_url(self, obj):
        request = self.context.get('request')
        if obj.image and request:
            return request.build_absolute_uri(obj.image.url)
        return None


class CommunityPostSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    author_role = serializers.SerializerMethodField()
    author_youth_type = serializers.SerializerMethodField()
    author_barangay = serializers.SerializerMethodField()
    author_avatar = serializers.SerializerMethodField()
    images = CommunityPostImageSerializer(many=True, read_only=True)
    like_count = serializers.IntegerField(source='reactions.count', read_only=True)
    is_liked = serializers.SerializerMethodField()
    is_own = serializers.SerializerMethodField()

    class Meta:
        model = CommunityPost
        fields = [
            'id', 'content', 'images', 'is_pinned', 'created_at',
            'author_name', 'author_role', 'author_youth_type',
            'author_barangay', 'author_avatar',
            'like_count', 'is_liked', 'is_own',
        ]
        read_only_fields = ['id', 'created_at']

    def get_author_name(self, obj):
        return obj.author.get_full_name() or obj.author.email

    def get_author_role(self, obj):
        return getattr(obj.author, 'role', '')

    def get_author_youth_type(self, obj):
        return getattr(obj.author, 'youth_type', '')

    def get_author_barangay(self, obj):
        profile = getattr(obj.author, 'profile', None)
        return getattr(profile, 'barangay', '') if profile else ''

    def get_author_avatar(self, obj):
        if obj.author.avatar:
            request = self.context.get('request')
            return request.build_absolute_uri(obj.author.avatar.url) if request else None
        return None

    def get_is_liked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.reactions.filter(user=request.user).exists()
        return False

    def get_is_own(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.author_id == request.user.id
        return False
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd backend
venv/Scripts/python.exe manage.py test apps.community -v 2
```

Expected: `Ran 7 tests ... OK`

- [ ] **Step 5: Commit**

```bash
git add backend/apps/community/serializers.py backend/apps/community/tests.py
git commit -m "feat(community): update serializers — nested images, like_count, is_liked, is_pinned"
```

---

## Task 3: Update viewset (perform_create, react, pin, get_queryset)

**Files:**
- Modify: `backend/apps/community/views.py`
- Modify: `backend/apps/community/tests.py`

- [ ] **Step 1: Add viewset API tests**

Append to `backend/apps/community/tests.py`:

```python
from rest_framework.test import APIClient
from rest_framework import status
from django.db import models as db_models


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
```

- [ ] **Step 2: Run tests — expect failure**

```bash
cd backend
venv/Scripts/python.exe manage.py test apps.community.tests.CommunityPostViewSetTest -v 2
```

Expected: failures on `react` and `pin` (actions don't exist yet), and `is_liked` missing.

- [ ] **Step 3: Rewrite views**

Replace full contents of `backend/apps/community/views.py`:

```python
from rest_framework import viewsets, permissions, parsers
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from django.db import models
from .models import CommunityPost, CommunityPostImage, PostReaction
from .serializers import CommunityPostSerializer


class IsVerifiedOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        user = request.user
        if not user or not user.is_authenticated:
            return False
        role = getattr(user, 'role', '')
        is_verified = getattr(user, 'is_email_verified', False)
        return role in ('lgu_admin', 'super_admin') or is_verified


class CommunityPostViewSet(viewsets.ModelViewSet):
    serializer_class = CommunityPostSerializer
    permission_classes = [IsVerifiedOrAdmin]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]
    http_method_names = ['get', 'post', 'delete', 'head', 'options']

    def get_queryset(self):
        qs = CommunityPost.objects \
            .select_related('author', 'author__profile') \
            .prefetch_related('images', 'reactions') \
            .annotate(pin_order=models.Case(
                models.When(is_pinned=True, then=0), default=1,
                output_field=models.IntegerField(),
            )) \
            .order_by('pin_order', '-created_at')
        barangay = self.request.query_params.get('barangay')
        if barangay:
            qs = qs.filter(author__profile__barangay=barangay)
        return qs

    def perform_create(self, serializer):
        post = serializer.save(author=self.request.user)
        for i, f in enumerate(self.request.FILES.getlist('images')[:4]):
            CommunityPostImage.objects.create(post=post, image=f, order=i)

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['request'] = self.request
        return ctx

    def destroy(self, request, *args, **kwargs):
        post = self.get_object()
        role = getattr(request.user, 'role', '')
        if post.author_id != request.user.id and role not in ('lgu_admin', 'super_admin'):
            raise PermissionDenied("You can only delete your own posts.")
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'], permission_classes=[IsVerifiedOrAdmin])
    def react(self, request, pk=None):
        post = self.get_object()
        reaction, created = PostReaction.objects.get_or_create(
            post=post, user=request.user
        )
        if not created:
            reaction.delete()
        return Response({'liked': created, 'count': post.reactions.count()})

    @action(detail=True, methods=['post'])
    def pin(self, request, pk=None):
        if getattr(request.user, 'role', '') not in ('lgu_admin', 'super_admin'):
            raise PermissionDenied("Admin only.")
        post = self.get_object()
        if post.is_pinned:
            post.is_pinned = False
            post.save(update_fields=['is_pinned'])
        else:
            CommunityPost.objects.filter(is_pinned=True).update(is_pinned=False)
            post.is_pinned = True
            post.save(update_fields=['is_pinned'])
        return Response({'is_pinned': post.is_pinned})
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd backend
venv/Scripts/python.exe manage.py test apps.community -v 2
```

Expected: `Ran 14 tests ... OK`

- [ ] **Step 5: Commit**

```bash
git add backend/apps/community/views.py backend/apps/community/tests.py
git commit -m "feat(community): add react and pin actions; combined get_queryset with pin ordering and barangay filter"
```

---

## Task 4: Update frontend API layer

**Files:**
- Modify: `frontend/src/api/community.ts`

- [ ] **Step 1: Rewrite `community.ts`**

Replace full contents of `frontend/src/api/community.ts`:

```typescript
import apiClient from './client'

export interface CommunityPostImage {
  id: number
  url: string
  order: number
}

export interface CommunityPost {
  id: number
  content: string
  images: CommunityPostImage[]
  is_pinned: boolean
  created_at: string
  author_name: string
  author_role: string
  author_youth_type: string
  author_barangay: string
  author_avatar: string | null
  is_own: boolean
  like_count: number
  is_liked: boolean
}

export interface CommunityPostPage {
  results: CommunityPost[]
  next: string | null
}

export const communityApi = {
  list: (page = 1, barangay?: string): Promise<CommunityPostPage> =>
    apiClient
      .get<CommunityPost[] | { results: CommunityPost[]; next: string | null }>(
        '/community/posts/',
        { params: { page, ...(barangay ? { barangay } : {}) } },
      )
      .then(r => {
        const d = r.data as any
        return {
          results: (Array.isArray(d) ? d : (d.results ?? [])) as CommunityPost[],
          next: d.next ?? null,
        }
      }),

  create: (data: FormData | { content: string }) =>
    apiClient.post<CommunityPost>('/community/posts/', data),

  delete: (id: number) => apiClient.delete(`/community/posts/${id}/`),

  react: (id: number) =>
    apiClient.post<{ liked: boolean; count: number }>(`/community/posts/${id}/react/`),

  pin: (id: number) =>
    apiClient.post<{ is_pinned: boolean }>(`/community/posts/${id}/pin/`),
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend
npx tsc --noEmit
```

Expected: exit 0, no output.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/community.ts
git commit -m "feat(community): update API types and methods — multi-image, react, pin, paginated list"
```

---

## Task 5: Rewrite CommunityHubPage — core state and infinite scroll

**Files:**
- Modify: `frontend/src/portals/youth/pages/hubs/CommunityHubPage.tsx`

This task replaces `useQuery` with `useInfiniteQuery` and adds `selectedBarangay` state. The post list will temporarily render exactly as before (just paginated now).

- [ ] **Step 1: Update imports and state at the top of the component**

In `CommunityHubPage.tsx`, replace the imports block and the state/query declarations inside `CommunityHubPage()` up through the `posts` derivation:

```typescript
import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Users, Building2, ArrowRight, MapPin, CheckCircle2,
  TrendingUp, Shield, Heart, Pin,
} from 'lucide-react'
import apiClient from '@/api/client'
import { communityApi } from '@/api/community'
import type { CommunityPost } from '@/api/community'
import { useAuthStore } from '@/store/authStore'
import { cn, toArray } from '@/utils'
import { Spinner } from '@/components/ui/Spinner'
```

Replace these state lines:
```typescript
// OLD — remove these three:
const [postContent, setPostContent] = useState('')
const [postImage, setPostImage] = useState<File | null>(null)
const [showPostForm, setShowPostForm] = useState(false)

const { data: posts = [] } = useQuery<CommunityPost[]>({
  queryKey: ['community-posts'],
  queryFn: () => communityApi.list(),
})
```

With:
```typescript
const [postContent, setPostContent] = useState('')
const [postImages, setPostImages] = useState<File[]>([])
const [showPostForm, setShowPostForm] = useState(false)
const [selectedBarangay, setSelectedBarangay] = useState<string>('')

const sentinelRef = useRef<HTMLDivElement>(null)

const {
  data: postsData,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
} = useInfiniteQuery({
  queryKey: ['community-posts', selectedBarangay],
  queryFn: ({ pageParam }) =>
    communityApi.list(pageParam as number, selectedBarangay || undefined),
  getNextPageParam: (lastPage, pages) =>
    lastPage.next ? pages.length + 1 : undefined,
  initialPageParam: 1,
})

const posts = postsData?.pages.flatMap(p => p.results) ?? []
```

- [ ] **Step 2: Add IntersectionObserver effect**

After the `posts` derivation, add:

```typescript
useEffect(() => {
  const el = sentinelRef.current
  if (!el) return
  const observer = new IntersectionObserver(
    ([entry]) => { if (entry.isIntersecting && hasNextPage) fetchNextPage() },
    { threshold: 0.1 }
  )
  observer.observe(el)
  return () => observer.disconnect()
}, [hasNextPage, fetchNextPage])
```

- [ ] **Step 3: Add sentinel + spinner at the bottom of the posts list**

Inside the `{/* Posts list */}` section, after the `posts.map(...)` block and before the empty-state paragraph, add:

```tsx
{/* Infinite scroll sentinel */}
<div ref={sentinelRef} className="h-4" />
{isFetchingNextPage && (
  <div className="flex justify-center py-4">
    <Spinner className="w-5 h-5 border-primary-400 border-t-transparent" />
  </div>
)}
```

- [ ] **Step 4: TypeScript check**

```bash
cd frontend
npx tsc --noEmit
```

Expected: exit 0, no output.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/portals/youth/pages/hubs/CommunityHubPage.tsx
git commit -m "feat(community): replace useQuery with useInfiniteQuery + IntersectionObserver sentinel"
```

---

## Task 6: Multi-photo composer

**Files:**
- Modify: `frontend/src/portals/youth/pages/hubs/CommunityHubPage.tsx`

- [ ] **Step 1: Add hidden file input ref**

Inside `CommunityHubPage`, before the `return`, add:

```typescript
const fileInputRef = useRef<HTMLInputElement>(null)

const previewUrls = postImages.map(f => URL.createObjectURL(f))

// Clean up object URLs when postImages changes or component unmounts
useEffect(() => {
  return () => { previewUrls.forEach(url => URL.revokeObjectURL(url)) }
}, [postImages]) // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 2: Replace the post form image section**

Find the existing `<input type="file" ...>` inside the post form and replace the entire image-related block (from the file input through the submit button's `onClick`) with:

```tsx
{/* Hidden file input */}
<input
  ref={fileInputRef}
  type="file"
  multiple
  accept="image/*"
  className="hidden"
  onChange={e => {
    const files = Array.from(e.target.files ?? [])
    setPostImages(prev => {
      const combined = [...prev, ...files]
      return combined.slice(0, 4)
    })
    e.target.value = ''
  }}
/>

{/* Thumbnail strip */}
{postImages.length > 0 && (
  <div className="flex gap-2 flex-wrap mt-2 mb-1">
    {postImages.map((file, i) => (
      <div key={i} className="relative w-[72px] h-[72px] flex-shrink-0">
        <img
          src={previewUrls[i]}
          alt=""
          className="w-full h-full object-cover rounded-lg"
        />
        <button
          type="button"
          onClick={() => setPostImages(prev => prev.filter((_, idx) => idx !== i))}
          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-800/70 hover:bg-gray-900 text-white rounded-full flex items-center justify-center text-xs leading-none"
        >
          ×
        </button>
      </div>
    ))}
    {postImages.length < 4 && (
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="w-[72px] h-[72px] flex-shrink-0 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-primary-400 hover:text-primary-500 transition-colors text-xs gap-1"
      >
        <span className="text-xl leading-none">+</span>
        <span>Add</span>
      </button>
    )}
  </div>
)}

{/* Toolbar row */}
<div className="flex items-center justify-between mt-2">
  <button
    type="button"
    onClick={() => fileInputRef.current?.click()}
    disabled={postImages.length >= 4}
    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary-600 disabled:opacity-40 disabled:cursor-not-allowed px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
  >
    📷 Add photos {postImages.length > 0 && `(${postImages.length}/4)`}
  </button>
  <div className="flex gap-2">
    <button
      type="button"
      onClick={() => { setShowPostForm(false); setPostContent(''); setPostImages([]) }}
      className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1"
    >
      Cancel
    </button>
    <button
      type="button"
      onClick={() => {
        if (!postContent.trim()) return
        const fd = new FormData()
        fd.append('content', postContent)
        postImages.forEach(f => fd.append('images', f))
        createPostMutation.mutate(fd)
        setShowPostForm(false)
        setPostContent('')
        setPostImages([])
      }}
      disabled={!postContent.trim() || createPostMutation.isPending}
      className="bg-indigo-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
    >
      Post
    </button>
  </div>
</div>
```

- [ ] **Step 3: TypeScript check**

```bash
cd frontend
npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/portals/youth/pages/hubs/CommunityHubPage.tsx
git commit -m "feat(community): multi-photo composer with thumbnail strip and individual remove"
```

---

## Task 7: PhotoGrid component + post card image display

**Files:**
- Modify: `frontend/src/portals/youth/pages/hubs/CommunityHubPage.tsx`

- [ ] **Step 1: Add PhotoGrid subcomponent**

At the bottom of `CommunityHubPage.tsx`, after the existing sub-components, add:

```tsx
function PhotoGrid({ images }: { images: { id: number; url: string }[] }) {
  if (images.length === 0) return null

  if (images.length === 1) {
    return (
      <div className="overflow-hidden">
        <img
          src={images[0].url}
          alt=""
          className="w-full object-cover"
          style={{ aspectRatio: '4/3' }}
        />
      </div>
    )
  }

  if (images.length === 2) {
    return (
      <div className="grid grid-cols-2 gap-0.5 overflow-hidden">
        {images.map(img => (
          <img key={img.id} src={img.url} alt="" className="w-full aspect-square object-cover" />
        ))}
      </div>
    )
  }

  if (images.length === 3) {
    return (
      <div
        className="grid gap-0.5 overflow-hidden"
        style={{ gridTemplateColumns: '2fr 1fr', gridTemplateRows: 'auto auto' }}
      >
        <img
          src={images[0].url}
          alt=""
          className="w-full object-cover"
          style={{ gridRow: '1 / 3', aspectRatio: '1' }}
        />
        <img src={images[1].url} alt="" className="w-full aspect-square object-cover" />
        <img src={images[2].url} alt="" className="w-full aspect-square object-cover" />
      </div>
    )
  }

  // 4 images
  return (
    <div className="grid grid-cols-2 gap-0.5 overflow-hidden">
      {images.map(img => (
        <img key={img.id} src={img.url} alt="" className="w-full aspect-square object-cover" />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Replace old image display in post cards**

In the posts list section, find the old image render inside each post card:

```tsx
{post.image_url && (
  <img src={post.image_url} alt="" className="mt-3 rounded-lg max-h-64 w-full object-cover" />
)}
```

Replace it with:

```tsx
{post.images.length > 0 && (
  <div className="mt-3 rounded-xl overflow-hidden">
    <PhotoGrid images={post.images} />
  </div>
)}
```

- [ ] **Step 3: TypeScript check**

```bash
cd frontend
npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/portals/youth/pages/hubs/CommunityHubPage.tsx
git commit -m "feat(community): PhotoGrid component with 1/2/3/4 photo Instagram-style layouts"
```

---

## Task 8: Barangay filter chips

**Files:**
- Modify: `frontend/src/portals/youth/pages/hubs/CommunityHubPage.tsx`

- [ ] **Step 1: Derive barangay list from existing data**

After the `avgCompliance` line (already computed from `barangays`), add:

```typescript
const barangayNames = barangays.map(b => b.barangay_name).sort()
```

- [ ] **Step 2: Add filter chips UI above the feed**

In the `{/* Community Feed */}` section, between the `<h2>Community Feed</h2>` and the post creation form, add:

```tsx
{/* Barangay filter */}
{barangayNames.length > 0 && (
  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
    <button
      onClick={() => setSelectedBarangay('')}
      className={cn(
        'flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold border transition-colors',
        selectedBarangay === ''
          ? 'bg-primary-600 text-white border-primary-600'
          : 'bg-white text-ink-600 border-ink-200 hover:border-primary-400',
      )}
    >
      All
    </button>
    {barangayNames.map(name => (
      <button
        key={name}
        onClick={() => setSelectedBarangay(name)}
        className={cn(
          'flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold border transition-colors whitespace-nowrap',
          selectedBarangay === name
            ? 'bg-primary-600 text-white border-primary-600'
            : 'bg-white text-ink-600 border-ink-200 hover:border-primary-400',
        )}
      >
        {name}
      </button>
    ))}
  </div>
)}
```

- [ ] **Step 3: TypeScript check**

```bash
cd frontend
npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/portals/youth/pages/hubs/CommunityHubPage.tsx
git commit -m "feat(community): barangay filter chip row above feed"
```

---

## Task 9: Heart/like reactions

**Files:**
- Modify: `frontend/src/portals/youth/pages/hubs/CommunityHubPage.tsx`

- [ ] **Step 1: Add like mutation with optimistic update**

Inside `CommunityHubPage`, after `deletePostMutation`, add:

```typescript
const likeMutation = useMutation({
  mutationFn: (id: number) => communityApi.react(id),
  onMutate: async (id) => {
    await queryClient.cancelQueries({ queryKey: ['community-posts', selectedBarangay] })
    const prev = queryClient.getQueryData(['community-posts', selectedBarangay])
    queryClient.setQueryData(
      ['community-posts', selectedBarangay],
      (old: any) => {
        if (!old) return old
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            results: page.results.map((p: CommunityPost) =>
              p.id === id
                ? {
                    ...p,
                    is_liked: !p.is_liked,
                    like_count: p.is_liked ? p.like_count - 1 : p.like_count + 1,
                  }
                : p,
            ),
          })),
        }
      },
    )
    return { prev }
  },
  onError: (_err, _id, ctx) => {
    if (ctx?.prev) {
      queryClient.setQueryData(['community-posts', selectedBarangay], ctx.prev)
    }
  },
})
```

- [ ] **Step 2: Add heart button to each post card**

Inside each post card's content area, after the `<p className="mt-2 text-sm ...">` (post text) and the `PhotoGrid`, add:

```tsx
{/* Reaction bar */}
<div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2">
  <button
    onClick={() => auth.isAuthenticated && likeMutation.mutate(post.id)}
    disabled={!auth.isAuthenticated}
    className={cn(
      'flex items-center gap-1.5 text-sm transition-colors disabled:cursor-default',
      post.is_liked
        ? 'text-red-500'
        : 'text-gray-400 hover:text-red-400',
    )}
  >
    <Heart
      size={16}
      className={post.is_liked ? 'fill-red-500' : ''}
    />
    <span className="font-medium">{post.like_count}</span>
  </button>
</div>
```

- [ ] **Step 3: TypeScript check**

```bash
cd frontend
npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/portals/youth/pages/hubs/CommunityHubPage.tsx
git commit -m "feat(community): heart/like reactions with optimistic update"
```

---

## Task 10: Pinned badge + admin pin button

**Files:**
- Modify: `frontend/src/portals/youth/pages/hubs/CommunityHubPage.tsx`

- [ ] **Step 1: Add pin mutation**

Inside `CommunityHubPage`, after `likeMutation`, add:

```typescript
const pinMutation = useMutation({
  mutationFn: (id: number) => communityApi.pin(id),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['community-posts', selectedBarangay] }),
})

const isAdmin =
  auth.user?.role === 'lgu_admin' || auth.user?.role === 'super_admin'
```

- [ ] **Step 2: Add pinned badge to post card header**

Inside the post card header row (next to author name), add a pinned chip before the delete button. Find the `{post.is_own && <button ...Delete...>}` block and add:

```tsx
{/* Card header actions row — find the flex row containing author + delete button */}
{/* Add pinned badge next to the author info: */}
{post.is_pinned && (
  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
    <Pin size={9} /> Pinned
  </span>
)}
```

Place the pinned badge between the author name/date block and the right-side buttons. The header row div should look like:

```tsx
<div className="flex items-center justify-between">
  <div>
    {/* author name + date — unchanged */}
  </div>
  <div className="flex items-center gap-2">
    {post.is_pinned && (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
        <Pin size={9} /> Pinned
      </span>
    )}
    {isAdmin && (
      <button
        onClick={() => pinMutation.mutate(post.id)}
        disabled={pinMutation.isPending}
        className="text-xs text-gray-400 hover:text-amber-600 disabled:opacity-50"
      >
        {post.is_pinned ? 'Unpin' : 'Pin'}
      </button>
    )}
    {post.is_own && (
      <button
        onClick={() => deletePostMutation.mutate(post.id)}
        className="text-xs text-gray-400 hover:text-red-500"
      >
        Delete
      </button>
    )}
  </div>
</div>
```

- [ ] **Step 3: TypeScript check**

```bash
cd frontend
npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 4: Full backend test suite**

```bash
cd backend
venv/Scripts/python.exe manage.py test apps.community -v 2
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/portals/youth/pages/hubs/CommunityHubPage.tsx
git commit -m "feat(community): pinned badge and admin pin/unpin button on post cards"
```
