from rest_framework import viewsets, permissions, parsers, status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from django.db import models
from .models import CommunityPost, CommunityPostImage, PostReaction, CommunityComment, REACTION_TYPES
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
        from django.db.models import Count, Exists, OuterRef, Value, BooleanField, Q, Subquery, CharField
        user = self.request.user
        reactions_for_user = PostReaction.objects.filter(
            post=OuterRef('pk'), user_id=user.pk
        )
        my_reaction = PostReaction.objects.filter(post=OuterRef('pk'), user_id=user.pk).values('reaction_type')[:1]
        qs = CommunityPost.objects \
            .select_related('author', 'author__profile') \
            .prefetch_related('images', 'reactions') \
            .annotate(
                pin_order=models.Case(
                    models.When(is_pinned=True, then=0), default=1,
                    output_field=models.IntegerField(),
                ),
                like_count=Count('reactions', distinct=True),
                # only comments everybody can see: hidden and emptied ones are not counted
                comment_count=Count('comments', filter=Q(comments__is_hidden=False, comments__is_deleted=False), distinct=True),
                my_reaction=Subquery(my_reaction, output_field=CharField()) if user.is_authenticated else Value(None, output_field=CharField()),
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
        """
        React with one of the seven reactions. One row per user per post:
          no reaction yet        -> it is added                (post owner is notified)
          a different reaction   -> the same row is changed    (count unchanged)
          the same reaction again-> it is removed
        With no body the old behaviour (a plain like, toggled) is kept.
        """
        post = self.get_object()
        wanted = (request.data.get('reaction') or 'like')
        if wanted not in dict(REACTION_TYPES):
            return Response({'detail': 'Unknown reaction.'}, status=status.HTTP_400_BAD_REQUEST)
        from django.utils import timezone
        reaction, created = PostReaction.objects.get_or_create(
            post=post, user=request.user, defaults={'reaction_type': wanted},
        )
        if created:
            mine, bump = wanted, True
        elif reaction.reaction_type == wanted:
            reaction.delete()
            mine, bump = None, False
        else:
            reaction.reaction_type = wanted
            reaction.updated_at = timezone.now()
            reaction.save(update_fields=['reaction_type', 'updated_at'])
            mine, bump = wanted, False
        # grouped notification to the post owner (nothing for their own reaction; quiet update on change/removal)
        notify.sync_reaction_notification(post, bump=bump)
        return Response({
            'liked': mine is not None,
            'reaction': mine,
            'count': PostReaction.objects.filter(post=post).count(),
            'summary': notify.reaction_summary(post),
        })

    @action(detail=True, methods=['get'], permission_classes=[permissions.AllowAny])
    def reactors(self, request, pk=None):
        """Everyone who reacted to this post. Public like the feed itself, so visitors who are not signed in can see it too:
        name, photo and account type only, never an email or any other private detail."""
        post = self.get_object()
        rows = PostReaction.objects.filter(post=post).select_related('user').order_by('-updated_at', '-id')
        people = []
        for r in rows:
            u = r.user
            avatar = request.build_absolute_uri(u.avatar.url) if u.avatar else None
            people.append({
                'id': u.id,
                'name': notify.name_of(u),
                'avatar': avatar,
                'account_type': notify.account_type(u),
                'reaction': r.reaction_type,
                'reacted_at': r.updated_at,
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
            qs = post.comments.select_related('author', 'post').order_by('created_at')
            if not self._can_moderate(request.user, post):
                # everybody else never sees hidden comments (or replies written under one)
                qs = qs.filter(is_hidden=False).exclude(parent__is_hidden=True)
            serializer = CommunityCommentSerializer(qs, many=True, context={'request': request})
            return Response(serializer.data)
        if not request.user.is_authenticated:
            raise PermissionDenied("Authentication required.")
        content = (request.data.get('content') or '').strip()
        if not content:
            return Response({'detail': 'Content is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if len(content) > 1000:
            return Response({'detail': 'Comment too long (max 1000 characters).'}, status=status.HTTP_400_BAD_REQUEST)
        parent = None
        parent_id = request.data.get('parent')
        if parent_id:
            parent = post.comments.filter(pk=parent_id, is_deleted=False, is_hidden=False).first()
            if parent is None:
                return Response({'detail': 'The comment you are replying to is no longer available.'}, status=status.HTTP_400_BAD_REQUEST)
        comment = CommunityComment.objects.create(post=post, author=request.user, content=content, parent=parent)
        if parent is not None:
            notify.notify_reply(post, comment, parent, request.user)
            # the post owner still hears about it, unless they are the one being answered
            if post.author_id != parent.author_id:
                notify.notify_comment(post, comment, request.user)
        else:
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
        # the writer, the owner of the post (they may remove anything sensitive under their own post), or a LYDO admin
        if comment.author_id != request.user.id and post.author_id != request.user.id and role not in ('lgu_admin', 'super_admin'):
            raise PermissionDenied("You can only delete your own comments or comments on your own post.")
        comment_id = comment.pk
        if comment.replies.exists():
            # keep the thread together: the replies stay under an emptied placeholder
            comment.is_deleted = True
            comment.content = ''
            comment.save(update_fields=['is_deleted', 'content'])
        else:
            comment.delete()
        notify.forget_comment(comment_id)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @staticmethod
    def _can_moderate(user, post):
        """The post owner and LYDO admins may hide and restore comments on this post."""
        return bool(user and user.is_authenticated) and (
            post.author_id == user.id or getattr(user, 'role', '') in ('lgu_admin', 'super_admin'))

    @action(detail=True, methods=['post'], url_path=r'comments/(?P<comment_id>[^/.]+)/hide',
            permission_classes=[IsVerifiedOrAdmin])
    def hide_comment(self, request, pk=None, comment_id=None):
        return self._set_hidden(request, comment_id, True)

    @action(detail=True, methods=['post'], url_path=r'comments/(?P<comment_id>[^/.]+)/restore',
            permission_classes=[IsVerifiedOrAdmin])
    def restore_comment(self, request, pk=None, comment_id=None):
        return self._set_hidden(request, comment_id, False)

    def _set_hidden(self, request, comment_id, hidden):
        """Hiding keeps the comment in the database; only the post owner or an admin can hide or restore it."""
        from django.utils import timezone
        post = self.get_object()
        if not self._can_moderate(request.user, post):
            raise PermissionDenied('Only the post owner or a LYDO admin can hide comments.')
        comment = post.comments.filter(pk=comment_id).first()
        if comment is None:
            return Response({'detail': 'Comment not found.'}, status=status.HTTP_404_NOT_FOUND)
        if hidden and comment.author_id == request.user.id and post.author_id == request.user.id:
            return Response({'detail': 'You cannot hide your own comment; delete it instead.'}, status=status.HTTP_400_BAD_REQUEST)
        comment.is_hidden = hidden
        comment.hidden_by = request.user if hidden else None
        comment.hidden_at = timezone.now() if hidden else None
        comment.save(update_fields=['is_hidden', 'hidden_by', 'hidden_at'])
        return Response(CommunityCommentSerializer(comment, context={'request': request}).data)
