import bleach
from rest_framework import serializers

from .models import (
    Project,
    ProjectComment,
    ProjectMember,
    ProjectResource,
    Task,
    Milestone,
)

BLEACH_ALLOWED_TAGS = ['b', 'i', 'u', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li', 'a']
BLEACH_ALLOWED_ATTRS = {'a': ['href', 'title', 'rel']}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


def sanitize(value):
    if isinstance(value, str):
        return bleach.clean(
            value,
            tags=BLEACH_ALLOWED_TAGS,
            attributes=BLEACH_ALLOWED_ATTRS,
            strip=True,
        )
    return value


# ---------------------------------------------------------------------------
# ProjectMember
# ---------------------------------------------------------------------------

class ProjectMemberSerializer(serializers.ModelSerializer):
    user_full_name = serializers.CharField(source='user.get_full_name', read_only=True)
    user_email = serializers.EmailField(source='user.email', read_only=True)

    class Meta:
        model = ProjectMember
        fields = ['id', 'project', 'user', 'user_full_name', 'user_email', 'role', 'joined_at']
        read_only_fields = ['joined_at']

    def validate(self, attrs):
        project = attrs.get('project')
        user = attrs.get('user')
        if project and user:
            if ProjectMember.objects.filter(project=project, user=user).exists():
                raise serializers.ValidationError('This user is already a member of the project.')
        return attrs


# ---------------------------------------------------------------------------
# Task
# ---------------------------------------------------------------------------

class TaskSerializer(serializers.ModelSerializer):
    assigned_to_name = serializers.CharField(
        source='assigned_to.get_full_name', read_only=True, default=None
    )

    class Meta:
        model = Task
        fields = [
            'id',
            'project',
            'title',
            'description',
            'assigned_to',
            'assigned_to_name',
            'status',
            'priority',
            'due_date',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']

    def validate_title(self, value):
        return sanitize(value)

    def validate_description(self, value):
        return sanitize(value)


# ---------------------------------------------------------------------------
# Milestone
# ---------------------------------------------------------------------------

class MilestoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = Milestone
        fields = [
            'id',
            'project',
            'title',
            'description',
            'due_date',
            'completed',
            'completed_at',
            'created_at',
        ]
        read_only_fields = ['created_at', 'completed_at']

    def validate_title(self, value):
        return sanitize(value)

    def validate_description(self, value):
        return sanitize(value)


# ---------------------------------------------------------------------------
# ProjectResource
# ---------------------------------------------------------------------------

class ProjectResourceSerializer(serializers.ModelSerializer):
    uploaded_by = serializers.HiddenField(default=serializers.CurrentUserDefault())

    class Meta:
        model = ProjectResource
        fields = ['id', 'project', 'title', 'file', 'url', 'uploaded_by', 'uploaded_at']
        read_only_fields = ['uploaded_at']

    def validate_title(self, value):
        return sanitize(value)

    def validate_file(self, value):
        if value and value.size > MAX_FILE_SIZE:
            raise serializers.ValidationError(
                f'File size must not exceed {MAX_FILE_SIZE // (1024 * 1024)} MB.'
            )
        return value

    def validate(self, attrs):
        if not attrs.get('file') and not attrs.get('url'):
            raise serializers.ValidationError('Either a file or a URL must be provided.')
        return attrs


# ---------------------------------------------------------------------------
# ProjectComment
# ---------------------------------------------------------------------------

class ProjectCommentSerializer(serializers.ModelSerializer):
    author = serializers.HiddenField(default=serializers.CurrentUserDefault())
    author_name = serializers.SerializerMethodField()
    replies = serializers.SerializerMethodField()

    class Meta:
        model = ProjectComment
        fields = [
            'id',
            'project',
            'author',
            'author_name',
            'content',
            'parent',
            'replies',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']

    def get_author_name(self, obj):
        return obj.author.get_full_name() if obj.author else None

    def get_replies(self, obj):
        if obj.replies.exists():
            return ProjectCommentSerializer(
                obj.replies.all(), many=True, context=self.context
            ).data
        return []

    def validate_content(self, value):
        return sanitize(value)


# ---------------------------------------------------------------------------
# Project list / detail
# ---------------------------------------------------------------------------

class ProjectListSerializer(serializers.ModelSerializer):
    member_count = serializers.IntegerField(read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)

    class Meta:
        model = Project
        fields = [
            'id',
            'title',
            'slug',
            'category',
            'status',
            'thumbnail',
            'start_date',
            'end_date',
            'is_public',
            'tags',
            'created_by_name',
            'member_count',
            'created_at',
        ]


class ProjectDetailSerializer(serializers.ModelSerializer):
    members = ProjectMemberSerializer(many=True, read_only=True)
    tasks = TaskSerializer(many=True, read_only=True)
    milestones = MilestoneSerializer(many=True, read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    is_member = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            'id',
            'title',
            'slug',
            'description',
            'category',
            'created_by',
            'created_by_name',
            'status',
            'thumbnail',
            'start_date',
            'end_date',
            'is_public',
            'tags',
            'created_at',
            'updated_at',
            'members',
            'tasks',
            'milestones',
            'is_member',
        ]
        read_only_fields = ['slug', 'created_at', 'updated_at', 'created_by']

    def get_is_member(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.members.filter(user=request.user).exists()
        return False

    def validate_title(self, value):
        return sanitize(value)

    def validate_description(self, value):
        return sanitize(value)
