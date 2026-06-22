# Community Feed — Reactions, Infinite Scroll, Pinned Posts, Barangay Filter

**Date:** 2026-06-18  
**Status:** Approved

---

## Scope

Four independent improvements to the community feed, all within `CommunityHubPage.tsx` and `backend/apps/community/`.

---

## 1. Post Reactions (Heart / Like)

### Goal
Each post shows a heart button with a like count. Tapping toggles your like on/off.

### Backend

**New model: `PostReaction`**
```python
class PostReaction(models.Model):
    post = models.ForeignKey(CommunityPost, on_delete=models.CASCADE, related_name='reactions')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('post', 'user')]
```

Migration: `0003_postreaction.py`

**New viewset action on `CommunityPostViewSet`:**
```python
@action(detail=True, methods=['post'], permission_classes=[IsVerifiedOrAdmin])
def react(self, request, pk=None):
    post = self.get_object()
    reaction, created = PostReaction.objects.get_or_create(post=post, user=request.user)
    if not created:
        reaction.delete()
    return Response({'liked': created, 'count': post.reactions.count()})
```

**Serializer additions on `CommunityPostSerializer`:**
- `like_count = serializers.IntegerField(source='reactions.count', read_only=True)`
- `is_liked = serializers.SerializerMethodField()` — returns `True` if `request.user` has a reaction
- Add both to `fields` list

### Frontend

**`CommunityPost` type additions:**
```typescript
like_count: number
is_liked: boolean
```

**`communityApi` addition:**
```typescript
react: (id: number) => apiClient.post(`/community/posts/${id}/react/`)
```

**Post card UI:** Heart button at the bottom of each card.
- Liked state: filled red heart `❤️` + count in red
- Unliked state: outline heart `🤍` + count in gray
- On click: optimistic update (toggle `is_liked`, ±1 on `like_count`) then call `communityApi.react()`. On error: revert optimistic update via `queryClient.setQueryData`.
- Disabled for unauthenticated / unverified users (same `canPost` rule).

---

## 2. Infinite Scroll

### Goal
The feed loads the first 20 posts. As the user scrolls to the bottom, the next page loads automatically. No "Load more" button.

### Backend
No changes. `CommunityPostViewSet` already uses `PageNumberPagination` with `PAGE_SIZE: 20`. The paginated response shape `{ count, next, previous, results }` is already handled by `communityApi.list()`.

### Frontend

**`communityApi.list()` signature change:**
```typescript
list: (page = 1) =>
  apiClient.get('/community/posts/', { params: { page } })
    .then(r => {
      const d = r.data as any
      return {
        results: (Array.isArray(d) ? d : (d.results ?? [])) as CommunityPost[],
        next: d.next ?? null,
      }
    })
```

**Replace `useQuery` with `useInfiniteQuery`:**
```typescript
const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
  queryKey: ['community-posts'],
  queryFn: ({ pageParam = 1 }) => communityApi.list(pageParam),
  getNextPageParam: (last, pages) => last.next ? pages.length + 1 : undefined,
  initialPageParam: 1,
})

const posts = data?.pages.flatMap(p => p.results) ?? []
```

**IntersectionObserver sentinel:**
A `<div ref={sentinelRef} />` placed after the last post. When it enters the viewport, `fetchNextPage()` is called. A small spinner shows while `isFetchingNextPage` is true. Nothing shown when `!hasNextPage`.

**Cache invalidation:** After `createPostMutation` or `deletePostMutation` succeeds, call `queryClient.invalidateQueries({ queryKey: ['community-posts'] })` — same as today; `useInfiniteQuery` re-fetches from page 1.

---

## 3. Pinned Announcements

### Goal
Admins (`lgu_admin`, `super_admin`) can pin a post so it always appears at the top of the feed with a "Pinned" badge. Only one post can be pinned at a time.

### Backend

**Model change on `CommunityPost`:**
```python
is_pinned = models.BooleanField(default=False)
```

Migration: `0004_communitypost_is_pinned.py`

**Ordering change:** Default ordering stays `['-created_at']`, but the queryset is annotated to sort pinned first:
```python
def get_queryset(self):
    return CommunityPost.objects \
        .select_related('author', 'author__profile') \
        .annotate(pin_order=models.Case(
            models.When(is_pinned=True, then=0), default=1,
            output_field=models.IntegerField()
        )) \
        .order_by('pin_order', '-created_at')
```

**New viewset action:**
```python
@action(detail=True, methods=['post'])
def pin(self, request, pk=None):
    # Role check — only lgu_admin / super_admin may pin
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

**Serializer:** Add `is_pinned = serializers.BooleanField(read_only=True)` to fields.

### Frontend

**`CommunityPost` type addition:** `is_pinned: boolean`

**`communityApi` addition:**
```typescript
pin: (id: number) => apiClient.post(`/community/posts/${id}/pin/`)
```

**Post card UI:**
- Pinned post shows a `📌 Pinned` badge (small chip, amber) in the card header.
- Admin users see a "Pin" / "Unpin" button next to the "Delete" button on their own posts and on all posts.
- On pin: `communityApi.pin(id)` → invalidate `['community-posts']`.

---

## 4. Barangay Filter

### Goal
A filter row above the feed lets users narrow posts to a specific barangay or see all. Defaults to "All".

### Backend

`get_queryset()` becomes the single combined method (pinned annotation + barangay filter merged):
```python
def get_queryset(self):
    qs = CommunityPost.objects \
        .select_related('author', 'author__profile') \
        .annotate(pin_order=models.Case(
            models.When(is_pinned=True, then=0), default=1,
            output_field=models.IntegerField()
        )) \
        .order_by('pin_order', '-created_at')
    barangay = self.request.query_params.get('barangay')
    if barangay:
        qs = qs.filter(author__profile__barangay=barangay)
    return qs
```

### Frontend

**`communityApi.list()` signature addition:** Accept optional `barangay` param alongside `page`:
```typescript
list: (page = 1, barangay?: string) =>
  apiClient.get('/community/posts/', { params: { page, ...(barangay ? { barangay } : {}) } })
    ...
```

**`useInfiniteQuery` key and queryFn** include `barangay` so changing the filter resets to page 1:
```typescript
queryKey: ['community-posts', selectedBarangay],
queryFn: ({ pageParam = 1 }) => communityApi.list(pageParam, selectedBarangay || undefined),
```

**Filter UI:** A horizontally scrollable chip row above the feed.
- "All" chip always first.
- One chip per unique barangay derived from `barangays` data already loaded on the page (`sk-requirements/barangays/` endpoint).
- Selected chip has `bg-primary-600 text-white`, others are outlined.
- Selecting a chip sets `selectedBarangay` state and resets the infinite query.

---

## Data Flow Summary

```
User scrolls → sentinel enters viewport → fetchNextPage() → GET /community/posts/?page=N&barangay=X
User likes post → optimistic update → POST /community/posts/{id}/react/ → revert on error
Admin pins post → POST /community/posts/{id}/pin/ → invalidate query → pinned post floats to top
User selects barangay chip → query key changes → query resets to page 1 with ?barangay=X
```

---

## Out of Scope

- Multiple reaction types (emoji reactions)
- Comments / comment threads
- Like notifications
- Post editing
- Who liked list / likers modal
