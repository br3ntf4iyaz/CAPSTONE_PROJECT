import bleach
from rest_framework import serializers

from .models import FAQ, SupportTicket, UserFeedback


class SupportTicketSerializer(serializers.ModelSerializer):
    assigned_to_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)

    # Admin-only fields – hidden from regular users via to_representation
    admin_notes_field = None  # SupportTicket has no notes field; placeholder for future use

    class Meta:
        model = SupportTicket
        fields = [
            'id',
            'user',
            'name',
            'email',
            'subject',
            'message',
            'admin_response',
            'status',
            'status_display',
            'priority',
            'priority_display',
            'created_at',
            'updated_at',
            'resolved_at',
            'assigned_to',
            'assigned_to_name',
        ]
        read_only_fields = [
            'user',
            'created_at',
            'updated_at',
            'resolved_at',
            'assigned_to_name',
        ]

    def get_assigned_to_name(self, obj):
        if obj.assigned_to:
            return (
                getattr(obj.assigned_to, 'get_full_name', lambda: obj.assigned_to.email)()
                or obj.assigned_to.email
            )
        return None

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        if request and hasattr(request.user, 'role'):
            role = request.user.role
            # Regular users cannot see assignment details
            if role not in ('lgu_admin', 'super_admin'):
                data.pop('assigned_to', None)
                data.pop('assigned_to_name', None)
                data.pop('priority', None)
                data.pop('priority_display', None)
        return data

    def validate_subject(self, value):
        return bleach.clean(value, tags=[], strip=True)

    def validate_message(self, value):
        return bleach.clean(value, tags=[], strip=True)

    def validate_name(self, value):
        return bleach.clean(value, tags=[], strip=True)

    def validate_admin_response(self, value):
        return bleach.clean(value, tags=[], strip=True)


class FAQSerializer(serializers.ModelSerializer):
    class Meta:
        model = FAQ
        fields = ['id', 'question', 'answer', 'category', 'order', 'is_published', 'created_at']
        read_only_fields = ['created_at']

    def validate_question(self, value):
        return bleach.clean(value, tags=[], strip=True)

    def validate_answer(self, value):
        # Allow basic formatting tags in FAQ answers
        allowed_tags = ['b', 'i', 'u', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li', 'a']
        return bleach.clean(value, tags=allowed_tags, strip=True)


class UserFeedbackSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserFeedback
        fields = ['id', 'user', 'rating', 'message', 'submitted_at', 'page']
        read_only_fields = ['user', 'submitted_at']

    def validate_message(self, value):
        return bleach.clean(value, tags=[], strip=True)

    def validate_rating(self, value):
        if not (1 <= value <= 5):
            raise serializers.ValidationError('Rating must be between 1 and 5.')
        return value
