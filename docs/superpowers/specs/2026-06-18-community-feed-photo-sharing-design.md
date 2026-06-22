# Community Feed — Instagram-style Photo Sharing

**Date:** 2026-06-18  
**Status:** Approved

---

## Goal

Allow users to attach up to 4 photos per community post. Photos are displayed in an Instagram-style grid that adapts to the count: 1 photo = full-width, 2 = side-by-side, 3 = large left + two stacked right, 4 = 2×2 grid. The post composer gets a polished photo picker with thumbnail previews and individual remove buttons.

---

## What Already Exists (no changes needed)

- `CommunityPost.image` — old single-image `ImageField`, never successfully used (serializer never exposed it as writable). Kept as-is but no longer used by new code.
- `CommunityPostSerializer.image_url` — old read-only method field. Will be replaced by `images` array.
- `CommunityPostViewSet` — parser classes already include `MultiPartParser` and `FormParser`. No viewset changes needed.
- `communityApi.create()` — already sends `FormData`. No API layer change needed.
- Frontend file input and `postImage` state — already exists but will be replaced by multi-file picker.

---

## Architecture

### Backend

#### New model: `CommunityPostImage`

```python
class CommunityPostImage(models.Model):
    post = models.ForeignKey(CommunityPost, on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(upload_to='community_posts/')
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['order']
```

#### Migration

`0002_communitypostimage.py` — creates the new table. The old `image` column on `CommunityPost` is left in place (nullable, no data) and ignored going forward.

#### Serializer changes (`CommunityPostSerializer`)

- Add nested `CommunityPostImageSerializer` (read-only):
  ```python
  class CommunityPostImageSerializer(serializers.ModelSerializer):
      url = serializers.SerializerMethodField()
      class Meta:
          model = CommunityPostImage
          fields = ['id', 'url', 'order']
  ```
- Replace `image_url = SerializerMethodField()` with `images = CommunityPostImageSerializer(many=True, read_only=True)`.
- Update `fields` list: remove `image_url`, add `images`.

#### Viewset `perform_create` override

After saving the post, read `request.FILES.getlist('images')`, cap at 4, and create one `CommunityPostImage` per file in order:

```python
def perform_create(self, serializer):
    post = serializer.save(author=self.request.user)
    for i, f in enumerate(self.request.FILES.getlist('images')[:4]):
        CommunityPostImage.objects.create(post=post, image=f, order=i)
```

### Frontend

#### `CommunityPost` type (`frontend/src/api/community.ts`)

Remove `image_url`. Add:
```typescript
images: { id: number; url: string; order: number }[]
```

#### Composer (`CommunityHubPage.tsx`)

Replace the single `postImage: File | null` state with `postImages: File[]`.

UI changes:
- Hidden `<input type="file" multiple accept="image/*">` triggered by an "Add photos" button.
- On file selection: append up to 4 total, ignore extras, show `URL.createObjectURL()` thumbnails (72×72, rounded, with ✕ overlay button to remove individual).
- An "Add" tile (dashed border) appears in the strip when fewer than 4 images are selected.
- On submit: append all files as `images` keys in FormData (`fd.append('images', file)` for each).
- After submit: revoke all object URLs to avoid memory leaks.

#### Photo grid renderer (inline component `PhotoGrid`)

Accepts `images: { id: number; url: string }[]`. Renders:

| Count | Layout |
|-------|--------|
| 1 | Single `<img>` full width, aspect-ratio 4/3, `object-cover` |
| 2 | CSS grid `grid-cols-2 gap-0.5`, each cell square |
| 3 | CSS grid `grid-cols-[2fr_1fr] grid-rows-2 gap-0.5`, first image spans both rows |
| 4 | CSS grid `grid-cols-2 gap-0.5`, four equal squares |

All images have `object-cover` and a subtle rounded overflow on the grid container. No lightbox in this iteration.

---

## Data Flow

```
User selects files → postImages[] state → thumbnail strip shown
↓
User clicks Post → FormData built → communityApi.create(fd)
↓
POST /community/posts/ (multipart) with fields: content, images[0..3]
↓
perform_create → CommunityPost saved → CommunityPostImage × N created
↓
Response: { ..., images: [{ id, url, order }, ...] }
↓
React Query invalidates ['community-posts'] → feed re-fetches → PhotoGrid renders
```

---

## Validation & Constraints

- **Max 4 photos per post** — enforced on both frontend (stop adding after 4) and backend (slice at 4 in `perform_create`).
- **File type** — frontend `accept="image/*"`. Backend relies on Django's `ImageField` validation (Pillow checks the actual file header).
- **File size** — no explicit limit in this iteration; Django's `DATA_UPLOAD_MAX_MEMORY_SIZE` (default 2.5 MB per request) provides a backstop.
- **Content required** — existing rule: post button disabled until content is non-empty. Photos alone (no text) are not allowed.

---

## Error Handling

- If the multipart upload fails (network / 400 / 413), the existing `createPostMutation.onError` path will surface the error via toast — no additional handling needed.
- Object URL cleanup: `useEffect` cleanup or explicit `URL.revokeObjectURL` calls after mutation settles.

---

## Out of Scope

- Photo lightbox / full-screen viewer
- Photo reordering via drag-and-drop
- Editing photos after posting
- 5+ photos
- Video support
- Removing the old `image` column from `CommunityPost`
