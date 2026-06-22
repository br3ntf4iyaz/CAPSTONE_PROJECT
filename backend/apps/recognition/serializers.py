import bleach
from django.conf import settings
from rest_framework import serializers

from .models import Announcement, Badge, Certificate, LeaderboardEntry, UserBadge

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
# Badge
# ---------------------------------------------------------------------------

class BadgeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Badge
        fields = [
            'id',
            'name',
            'description',
            'icon',
            'category',
            'criteria',
            'created_at',
            'is_active',
        ]
        read_only_fields = ['created_at']

    def validate_name(self, value):
        return sanitize(value)

    def validate_description(self, value):
        return sanitize(value)

    def validate_criteria(self, value):
        return sanitize(value)


# ---------------------------------------------------------------------------
# UserBadge
# ---------------------------------------------------------------------------

class UserMiniSerializer(serializers.Serializer):
    """Minimal user representation to avoid circular imports."""
    id = serializers.IntegerField()
    email = serializers.EmailField()
    full_name = serializers.SerializerMethodField()

    def get_full_name(self, obj):
        return obj.get_full_name()


class UserBadgeSerializer(serializers.ModelSerializer):
    badge = BadgeSerializer(read_only=True)
    badge_id = serializers.PrimaryKeyRelatedField(
        queryset=Badge.objects.all(), source='badge', write_only=True
    )
    user_detail = UserMiniSerializer(source='user', read_only=True)
    awarded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = UserBadge
        fields = [
            'id',
            'user',
            'user_detail',
            'badge',
            'badge_id',
            'earned_at',
            'awarded_by',
            'awarded_by_name',
        ]
        read_only_fields = ['earned_at', 'awarded_by']

    def get_awarded_by_name(self, obj):
        if obj.awarded_by:
            return obj.awarded_by.get_full_name()
        return None

    def validate(self, attrs):
        user = attrs.get('user')
        badge = attrs.get('badge')
        if user and badge and UserBadge.objects.filter(user=user, badge=badge).exists():
            raise serializers.ValidationError('This user already holds this badge.')
        return attrs


# ---------------------------------------------------------------------------
# Certificate
# ---------------------------------------------------------------------------

class CertificateSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)

    class Meta:
        model = Certificate
        fields = [
            'id',
            'user',
            'user_name',
            'title',
            'issued_by',
            'issued_at',
            'expiry_date',
            'certificate_number',
            'file',
            'enrollment',
            'created_at',
        ]
        read_only_fields = ['created_at']

    def validate_title(self, value):
        return sanitize(value)

    def validate_issued_by(self, value):
        return sanitize(value)

    def validate_file(self, value):
        if value and value.size > MAX_FILE_SIZE:
            raise serializers.ValidationError(
                f'File size must not exceed {MAX_FILE_SIZE // (1024 * 1024)} MB.'
            )
        return value

    def validate(self, attrs):
        issued = attrs.get('issued_at')
        expiry = attrs.get('expiry_date')
        if issued and expiry and expiry < issued:
            raise serializers.ValidationError('expiry_date must not be before issued_at.')
        return attrs


# ---------------------------------------------------------------------------
# LeaderboardEntry
# ---------------------------------------------------------------------------

class LeaderboardEntrySerializer(serializers.ModelSerializer):
    user = UserMiniSerializer(read_only=True)

    class Meta:
        model = LeaderboardEntry
        fields = [
            'id',
            'user',
            'total_score',
            'course_score',
            'governance_score',
            'project_score',
            'volunteer_score',
            'rank',
            'last_updated',
        ]
        read_only_fields = [
            'total_score',
            'course_score',
            'governance_score',
            'project_score',
            'volunteer_score',
            'rank',
            'last_updated',
        ]


# ---------------------------------------------------------------------------
# Announcement
# ---------------------------------------------------------------------------

class AnnouncementSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)

    class Meta:
        model = Announcement
        fields = [
            'id',
            'title',
            'content',
            'created_by',
            'created_by_name',
            'is_published',
            'published_at',
            'target_roles',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at']

    def validate_title(self, value):
        return sanitize(value)

    def validate_content(self, value):
        return sanitize(value)
