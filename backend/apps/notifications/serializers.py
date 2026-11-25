from rest_framework import serializers

from .models import BroadcastNotification, Notification


class NotificationSerializer(serializers.ModelSerializer):
    notification_type_display = serializers.CharField(
        source='get_notification_type_display', read_only=True
    )

    actor_name = serializers.SerializerMethodField()
    actor_avatar = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            'id',
            'title',
            'message',
            'notification_type',
            'notification_type_display',
            'is_read',
            'read_at',
            'link',
            'created_at',
            'actor_name',
            'actor_avatar',
            'post_id',
            'comment_id',
            'reaction_type',
        ]
        read_only_fields = ['is_read', 'read_at', 'created_at']

    def get_actor_name(self, obj):
        return (obj.actor.get_full_name() or obj.actor.email) if obj.actor_id else ''

    def get_actor_avatar(self, obj):
        if obj.actor_id and obj.actor.avatar:
            request = self.context.get('request')
            return request.build_absolute_uri(obj.actor.avatar.url) if request else obj.actor.avatar.url
        return None


class BroadcastCreateSerializer(serializers.Serializer):
    """Validates the payload sent by the admin notification form."""
    title = serializers.CharField(max_length=120)
    message = serializers.CharField()
    target_audience = serializers.ChoiceField(
        choices=[c[0] for c in BroadcastNotification.AUDIENCE_CHOICES],
        default='all',
    )
    send_email = serializers.BooleanField(default=False)
    attachment = serializers.FileField(required=False, allow_null=True)


class BroadcastNotificationSerializer(serializers.ModelSerializer):
    """Used for the admin-history response (mirrors SentNotification TS interface)."""
    sent_at = serializers.DateTimeField(read_only=True)
    sent_by_name = serializers.SerializerMethodField()

    class Meta:
        model = BroadcastNotification
        fields = [
            'id',
            'title',
            'message',
            'target_audience',
            'via_email',
            'recipient_count',
            'email_sent_count',
            'sent_by_name',
            'sent_at',
            'attachment',
        ]

    def get_sent_by_name(self, obj):
        if obj.sent_by:
            return f"{obj.sent_by.first_name} {obj.sent_by.last_name}".strip() or obj.sent_by.email
        return '—'
