from rest_framework import viewsets, permissions, parsers, status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from django.db import models
from .models import CommunityPost, CommunityPostImage, PostReaction, CommunityComment
from .serializers import CommunityPostSerializer, CommunityCommentSerializer
from . import notify


ALLOWED_IMAGE_TYPES = {'JPEG', 'PNG', 'WEBP', 'GIF'}
MAX_IMAGE_BYTES = 5 * 1024 * 1024
MAX_POST_CHARS = 2000


def validate_images(files):
    """Only real images (checked by content, not by file name), 5 MB each, at most 4."""
    from PIL import Image
    good = []
    for f in files[:4]:
        if f.size > MAX_IMAGE_BYTES:
            raise ValidationError({'images': 'Each photo must be 5 MB or smaller.'})
        try:
            img = Image.open(f)
            fmt = img.format
            img.verify()
        except Exception:
            raise ValidationError({'images': 'Only image files (JPG, PNG, WEBP, GIF) can be attached.'})
        if fmt not in ALLOWED_IMAGE_TYPES:
            raise ValidationError({'images': 'Only image files (JPG, PNG, WEBP, GIF) can be attached.'})
        f.seek(0)
        good.append(f)
    return good


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
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        from django.db.models import Count, Exists, OuterRef, Value, BooleanField
        user = self.request.user
        reactions_for_user = PostReaction.objects.filter(
            post=OuterRef('pk'), user_id=user.pk
        )
        qs = CommunityPost.objects \
            .select_related('author', 'author__profile') \
            .prefetch_related('images') \
            .annotate(
                pin_order=models.Case(
                    models.When(is_pinned=True, then=0), default=1,
                    output_field=models.IntegerField(),
                ),
                like_count=Count('reactions', distinct=True),
                comment_count=Count('comments', distinct=True),
                is_liked=Exists(reactions_for_user) if user.is_authenticated else Value(False, output_field=BooleanField()),
            ) \
            .order_by('pin_order', '-created_at')
        barangay = self.request.query_params.get('barangay')
        if barangay:
            qs = qs.filter(author__profile__barangay=barangay)
        if self.request.query_params.get('mine') == 'true' and user.is_authenticated:
            qs = qs.filter(author=user)
        return qs

    def create(self, request, *args, **kwargs):
        # Validate attachments first so a bad file never leaves a half-created post behind
        self._images = validate_images(request.FILES.getlist('images'))
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        post = serializer.save(author=self.request.user)
        for i, f in enumerate(getattr(self, '_images', [])):
            CommunityPostImage.objects.create(post=post, image=f, order=i)

    def partial_update(self, request, *args, **kwargs):
        post = self.get_object()
        role = getattr(request.user, 'role', '')
        if post.author_id != request.user.id and role not in ('lgu_admin', 'super_admin'):
            raise PermissionDenied("You can only edit your own posts.")
        content = (request.data.get('content') or '').strip()
        if not content:
            return Response({'detail': 'Content is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if len(content) > MAX_POST_CHARS:
            return Response({'detail': f'Post too long (max {MAX_POST_CHARS} characters).'}, status=status.HTTP_400_BAD_REQUEST)
        post.content = content
        post.save(update_fields=['content'])
        return Response(self.get_serializer(post).data)

    def destroy(self, request, *args, **kwargs):
        post = self.get_object()
        role = getattr(request.user, 'role', '')
        if post.author_id != request.user.id and role not in ('lgu_admin', 'super_admin'):
            raise PermissionDenied("You can only delete your own posts.")
        post_id = post.pk
        response = super().destroy(request, *args, **kwargs)
        notify.forget_post(post_id)  # no notification may keep pointing at a deleted post
        return response

    @action(detail=True, methods=['post'], permission_classes=[IsVerifiedOrAdmin])
    def react(self, request, pk=None):
        post = self.get_object()
        reaction, created = PostReaction.objects.get_or_create(
            post=post, user=request.user
        )
        if not created:
            reaction.delete()
        # grouped notification to the post owner (nothing for their own reaction; quiet update on removal)
        notify.sync_reaction_notification(post, bump=created)
        count = PostReaction.objects.filter(post=post).count()
        return Response({'liked': created, 'count': count})

    @action(detail=True, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def reactors(self, request, pk=None):
        """Everyone who reacted to this post (name, photo and account type only, no private details)."""
        post = self.get_object()
        rows = PostReaction.objects.filter(post=post).select_related('user').order_by('-created_at', '-id')
        people = []
        for r in rows:
            u = r.user
            avatar = request.build_absolute_uri(u.avatar.url) if u.avatar else None
            people.append({
                'id': u.id,
                'name': notify.name_of(u),
                'avatar': avatar,
                'account_type': notify.account_type(u),
                'reaction': 'heart',
                'reacted_at': r.created_at,
            })
        return Response({'count': len(people), 'results': people})

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

    @action(detail=True, methods=['get', 'post'], url_path='comments', permission_classes=[IsVerifiedOrAdmin])
    def comments(self, request, pk=None):
        post = self.get_object()
        if request.method == 'GET':
            qs = post.comments.select_related('author').order_by('created_at')
            serializer = CommunityCommentSerializer(qs, many=True, context={'request': request})
            return Response(serializer.data)
        if not request.user.is_authenticated:
            raise PermissionDenied("Authentication required.")
        content = (request.data.get('content') or '').strip()
        if not content:
            return Response({'detail': 'Content is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if len(content) > 1000:
            return Response({'detail': 'Comment too long (max 1000 characters).'}, status=status.HTTP_400_BAD_REQUEST)
        comment = CommunityComment.objects.create(post=post, author=request.user, content=content)
        notify.notify_comment(post, comment, request.user)
        serializer = CommunityCommentSerializer(comment, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(
        detail=True,
        methods=['delete'],
        url_path=r'comments/(?P<comment_id>[^/.]+)',
        permission_classes=[IsVerifiedOrAdmin],
    )
    def delete_comment(self, request, pk=None, comment_id=None):
        post = self.get_object()
        try:
            comment = post.comments.get(pk=comment_id)
        except CommunityComment.DoesNotExist:
            return Response({'detail': 'Comment not found.'}, status=status.HTTP_404_NOT_FOUND)
        role = getattr(request.user, 'role', '')
        if comment.author_id != request.user.id and role not in ('lgu_admin', 'super_admin'):
            raise PermissionDenied("You can only delete your own comments.")
        comment_id = comment.pk
        comment.delete()
        notify.forget_comment(comment_id)
        return Response(status=status.HTTP_204_NO_CONTENT)
