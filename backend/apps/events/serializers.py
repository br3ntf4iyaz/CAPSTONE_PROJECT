import bleach
from rest_framework import serializers

from .models import (
    Event,
    EventRegistration,
    Poll,
    PollOption,
    PollResponse,
    Survey,
    SurveyQuestion,
    SurveyResponse,
    Feedback,
    FeaturedPost,
)

BLEACH_ALLOWED_TAGS = ['b', 'i', 'u', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li', 'a']
BLEACH_ALLOWED_ATTRS = {'a': ['href', 'title', 'rel']}


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
# Event
# ---------------------------------------------------------------------------

class EventListSerializer(serializers.ModelSerializer):
    registration_count = serializers.IntegerField(read_only=True)
    is_registered = serializers.SerializerMethodField()
    is_attended = serializers.SerializerMethodField()

    class Meta:
        model = Event
        fields = [
            'id',
            'title',
            'description',
            'event_type',
            'start_datetime',
            'end_datetime',
            'location',
            'meeting_link',
            'thumbnail',
            'capacity',
            'is_published',
            'is_featured',
            'check_in_active',
            'registration_count',
            'is_registered',
            'is_attended',
        ]

    def get_is_registered(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.registrations.filter(user=request.user).exists()
        return False

    def get_is_attended(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            reg = obj.registrations.filter(user=request.user).first()
            return reg.attended if reg else False
        return False


class EventDetailSerializer(serializers.ModelSerializer):
    registration_count = serializers.IntegerField(read_only=True)
    is_registered = serializers.SerializerMethodField()
    is_attended = serializers.SerializerMethodField()

    class Meta:
        model = Event
        fields = [
            'id',
            'title',
            'description',
            'event_type',
            'organizer',
            'location',
            'meeting_link',
            'thumbnail',
            'start_datetime',
            'end_datetime',
            'capacity',
            'is_published',
            'is_featured',
            'is_active',
            'check_in_active',
            'check_in_code',
            'created_at',
            'updated_at',
            'registration_count',
            'is_registered',
            'is_attended',
        ]
        read_only_fields = ['created_at', 'updated_at', 'organizer', 'check_in_active', 'check_in_code']

    def get_is_registered(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.registrations.filter(user=request.user).exists()
        return False

    def get_is_attended(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            reg = obj.registrations.filter(user=request.user).first()
            return reg.attended if reg else False
        return False

    def validate_title(self, value):
        return sanitize(value)

    def validate_description(self, value):
        return sanitize(value)

    def validate_location(self, value):
        return sanitize(value)

    def validate(self, attrs):
        start = attrs.get('start_datetime')
        end = attrs.get('end_datetime')
        if start and end and end <= start:
            raise serializers.ValidationError('end_datetime must be after start_datetime.')
        return attrs


# ---------------------------------------------------------------------------
# EventRegistration
# ---------------------------------------------------------------------------

class EventRegistrationSerializer(serializers.ModelSerializer):
    user = serializers.HiddenField(default=serializers.CurrentUserDefault())

    class Meta:
        model = EventRegistration
        fields = ['id', 'event', 'user', 'registered_at', 'attended']
        read_only_fields = ['registered_at', 'attended']

    def validate(self, attrs):
        event = attrs.get('event')
        user = attrs.get('user')
        if EventRegistration.objects.filter(event=event, user=user).exists():
            raise serializers.ValidationError('You are already registered for this event.')
        if event.capacity and event.registrations.count() >= event.capacity:
            raise serializers.ValidationError('This event has reached its capacity.')
        return attrs


class AttendanceSerializer(serializers.ModelSerializer):
    """Admin-facing attendance record."""
    user_email = serializers.EmailField(source='user.email', read_only=True)
    user_full_name = serializers.CharField(source='user.get_full_name', read_only=True)

    class Meta:
        model = EventRegistration
        fields = ['id', 'user', 'user_email', 'user_full_name', 'registered_at', 'attended']


# ---------------------------------------------------------------------------
# Poll
# ---------------------------------------------------------------------------

class PollOptionSerializer(serializers.ModelSerializer):
    vote_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = PollOption
        fields = ['id', 'text', 'order', 'vote_count']

    def validate_text(self, value):
        return sanitize(value)


class PollSerializer(serializers.ModelSerializer):
    options = PollOptionSerializer(many=True, read_only=True)
    created_by = serializers.HiddenField(default=serializers.CurrentUserDefault())
    user_vote = serializers.SerializerMethodField()
    total_votes = serializers.SerializerMethodField()

    class Meta:
        model = Poll
        fields = [
            'id',
            'event',
            'question',
            'created_by',
            'is_active',
            'created_at',
            'ends_at',
            'options',
            'user_vote',
            'total_votes',
        ]
        read_only_fields = ['created_at']

    def get_user_vote(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        vote = PollResponse.objects.filter(poll=obj, user=request.user).first()
        return vote.option_id if vote else None

    def get_total_votes(self, obj):
        return sum(opt.vote_count for opt in obj.options.all())

    def validate_question(self, value):
        return sanitize(value)


# ---------------------------------------------------------------------------
# PollResponse
# ---------------------------------------------------------------------------

class PollResponseSerializer(serializers.ModelSerializer):
    user = serializers.HiddenField(default=serializers.CurrentUserDefault())

    class Meta:
        model = PollResponse
        fields = ['id', 'poll', 'option', 'user', 'responded_at']
        read_only_fields = ['responded_at']

    def validate(self, attrs):
        poll = attrs.get('poll')
        option = attrs.get('option')
        user = attrs.get('user')
        if not poll.is_active:
            raise serializers.ValidationError('This poll is no longer active.')
        if option.poll_id != poll.id:
            raise serializers.ValidationError('The selected option does not belong to this poll.')
        if PollResponse.objects.filter(poll=poll, user=user).exists():
            raise serializers.ValidationError('You have already responded to this poll.')
        return attrs


# ---------------------------------------------------------------------------
# Survey
# ---------------------------------------------------------------------------

class SurveyQuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = SurveyQuestion
        fields = ['id', 'question', 'question_type', 'choices', 'order']

    def validate_question(self, value):
        return sanitize(value)


class SurveySerializer(serializers.ModelSerializer):
    questions = SurveyQuestionSerializer(many=True, read_only=True)
    created_by = serializers.HiddenField(default=serializers.CurrentUserDefault())
    response_count = serializers.SerializerMethodField()
    has_responded = serializers.SerializerMethodField()

    class Meta:
        model = Survey
        fields = [
            'id',
            'title',
            'description',
            'event',
            'created_by',
            'is_active',
            'created_at',
            'questions',
            'response_count',
            'has_responded',
        ]
        read_only_fields = ['created_at']

    def validate_title(self, value):
        return sanitize(value)

    def validate_description(self, value):
        return sanitize(value)

    def get_response_count(self, obj):
        return obj.responses.count()

    def get_has_responded(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.responses.filter(user=request.user).exists()
        return False


# ---------------------------------------------------------------------------
# SurveyResponse
# ---------------------------------------------------------------------------

class SurveyResponseSerializer(serializers.ModelSerializer):
    user = serializers.HiddenField(default=serializers.CurrentUserDefault())

    class Meta:
        model = SurveyResponse
        fields = ['id', 'survey', 'user', 'answers', 'submitted_at']
        read_only_fields = ['submitted_at']

    def validate(self, attrs):
        survey = attrs.get('survey')
        user = attrs.get('user')
        if not survey.is_active:
            raise serializers.ValidationError('This survey is no longer active.')
        if SurveyResponse.objects.filter(survey=survey, user=user).exists():
            raise serializers.ValidationError('You have already submitted a response for this survey.')
        return attrs

    def validate_answers(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError(
                'Answers must be a JSON object mapping question IDs to responses.'
            )
        return value


# ---------------------------------------------------------------------------
# Feedback
# ---------------------------------------------------------------------------

class FeedbackSerializer(serializers.ModelSerializer):
    user = serializers.HiddenField(default=serializers.CurrentUserDefault())

    class Meta:
        model = Feedback
        fields = ['id', 'event', 'user', 'rating', 'comment', 'submitted_at']
        read_only_fields = ['submitted_at']

    def validate_comment(self, value):
        return sanitize(value)

    def validate_rating(self, value):
        if not (1 <= value <= 5):
            raise serializers.ValidationError('Rating must be between 1 and 5.')
        return value


# ---------------------------------------------------------------------------
# FeaturedPost
# ---------------------------------------------------------------------------

class FeaturedPostSerializer(serializers.ModelSerializer):
    class Meta:
        model = FeaturedPost
        fields = ['id', 'title', 'content', 'post_type', 'thumbnail', 'source',
                  'date_of_event', 'is_published', 'order', 'created_at']
        read_only_fields = ['created_at']
