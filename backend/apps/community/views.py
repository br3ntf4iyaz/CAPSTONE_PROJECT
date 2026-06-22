from rest_framework import viewsets, permissions, parsers, status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from django.db import models
from .models import CommunityPost, CommunityPostImage, PostReaction, CommunityComment
from .serializers import CommunityPostSerializer, CommunityCommentSerializer


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

    def perform_create(self, serializer):
        post = serializer.save(author=self.request.user)
        for i, f in enumerate(self.request.FILES.getlist('images')[:4]):
            CommunityPostImage.objects.create(post=post, image=f, order=i)

    def partial_update(self, request, *args, **kwargs):
        post = self.get_object()
        role = getattr(request.user, 'role', '')
        if post.author_id != request.user.id and role not in ('lgu_admin', 'super_admin'):
            raise PermissionDenied("You can only edit your own posts.")
        content = (request.data.get('content') or '').strip()
        if not content:
            return Response({'detail': 'Content is required.'}, status=status.HTTP_400_BAD_REQUEST)
        post.content = content
        post.save(update_fields=['content'])
        return Response(self.get_serializer(post).data)

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
        count = PostReaction.objects.filter(post=post).count()
        return Response({'liked': created, 'count': count})

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
        comment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
