from rest_framework import serializers
from .models import CommunityPost, CommunityPostImage, CommunityComment


class CommunityCommentSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    author_avatar = serializers.SerializerMethodField()
    is_own = serializers.SerializerMethodField()

    class Meta:
        model = CommunityComment
        fields = ['id', 'content', 'author_name', 'author_avatar', 'is_own', 'created_at']
        read_only_fields = ['id', 'created_at']

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

    class Meta:
        model = CommunityPost
        fields = [
            'id', 'content', 'images', 'is_pinned', 'created_at',
            'author_name', 'author_role', 'author_youth_type',
            'author_barangay', 'author_avatar',
            'like_count', 'is_liked', 'comment_count', 'is_own',
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

    def get_is_own(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.author_id == request.user.id
        return False
