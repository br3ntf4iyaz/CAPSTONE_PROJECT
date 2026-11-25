from rest_framework import serializers
from .models import CommunityPost, CommunityPostImage, CommunityComment


def _is_admin(user):
    return getattr(user, 'role', '') in ('lgu_admin', 'super_admin')


class CommunityCommentSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    author_avatar = serializers.SerializerMethodField()
    author_account_type = serializers.SerializerMethodField()
    is_own = serializers.SerializerMethodField()
    parent_id = serializers.IntegerField(read_only=True)
    can_delete = serializers.SerializerMethodField()
    can_hide = serializers.SerializerMethodField()
    hidden_label = serializers.SerializerMethodField()

    class Meta:
        model = CommunityComment
        fields = ['id', 'content', 'author_name', 'author_avatar', 'author_account_type', 'is_own', 'created_at',
                  'parent_id', 'is_hidden', 'is_deleted', 'can_delete', 'can_hide', 'hidden_label']
        read_only_fields = ['id', 'created_at']

    def get_author_account_type(self, obj):
        from .notify import account_type
        return account_type(obj.author)

    def _user(self):
        request = self.context.get('request')
        return request.user if request and request.user.is_authenticated else None

    def get_can_delete(self, obj):
        # the writer, the owner of the post, or a LYDO admin
        u = self._user()
        return bool(u) and not obj.is_deleted and (obj.author_id == u.id or obj.post.author_id == u.id or _is_admin(u))

    def get_can_hide(self, obj):
        u = self._user()
        return bool(u) and not obj.is_deleted and (
            _is_admin(u) or (obj.post.author_id == u.id and obj.author_id != u.id))

    def get_hidden_label(self, obj):
        if not obj.is_hidden:
            return ''
        by = obj.hidden_by
        return 'Hidden by LYDO admin' if by and _is_admin(by) and by.id != obj.post.author_id else 'Hidden by post owner'

    def get_author_name(self, obj):
        return obj.author.get_full_name() or obj.author.email

    def get_author_avatar(self, obj):
        if obj.author.avatar:
            request = self.context.get('request')
            return request.build_absolute_uri(obj.author.avatar.url) if request else None
        return None

    def get_is_own(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.author_id == request.user.id
        return False


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
    like_count = serializers.IntegerField(read_only=True)
    is_liked = serializers.BooleanField(read_only=True)
    comment_count = serializers.IntegerField(read_only=True)
    is_own = serializers.SerializerMethodField()
    my_reaction = serializers.CharField(read_only=True, allow_null=True)
    reaction_summary = serializers.SerializerMethodField()

    class Meta:
        model = CommunityPost
        fields = [
            'id', 'content', 'images', 'is_pinned', 'created_at',
            'author_name', 'author_role', 'author_youth_type',
            'author_barangay', 'author_avatar',
            'like_count', 'is_liked', 'comment_count', 'is_own',
            'my_reaction', 'reaction_summary',
        ]
        read_only_fields = ['id', 'created_at']

    def get_reaction_summary(self, obj):
        counts = {}
        for r in obj.reactions.all():  # prefetched by the viewset
            counts[r.reaction_type] = counts.get(r.reaction_type, 0) + 1
        return [{'type': t, 'count': n} for t, n in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))]

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

    def get_is_own(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.author_id == request.user.id
        return False
