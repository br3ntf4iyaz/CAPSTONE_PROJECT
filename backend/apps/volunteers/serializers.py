import bleach
from rest_framework import serializers

from .models import Team, TeamMember, VolunteerOpportunity, VolunteerSignup

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
# VolunteerOpportunity
# ---------------------------------------------------------------------------

class VolunteerOpportunitySerializer(serializers.ModelSerializer):
    posted_by_name = serializers.CharField(source='posted_by.get_full_name', read_only=True)
    signup_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = VolunteerOpportunity
        fields = [
            'id',
            'title',
            'description',
            'organization',
            'location',
            'event',
            'tags',
            'slots',
            'start_date',
            'end_date',
            'posted_by',
            'posted_by_name',
            'is_active',
            'created_at',
            'signup_count',
        ]
        read_only_fields = ['posted_by', 'created_at']

    def validate_title(self, value):
        return sanitize(value)

    def validate_description(self, value):
        return sanitize(value)

    def validate_organization(self, value):
        return sanitize(value)

    def validate_location(self, value):
        return sanitize(value)

    def validate(self, attrs):
        start = attrs.get('start_date')
        end = attrs.get('end_date')
        if start and end and end < start:
            raise serializers.ValidationError('end_date must not be before start_date.')
        return attrs


# ---------------------------------------------------------------------------
# VolunteerSignup
# ---------------------------------------------------------------------------

class VolunteerSignupSerializer(serializers.ModelSerializer):
    user = serializers.HiddenField(default=serializers.CurrentUserDefault())
    user_email = serializers.EmailField(source='user.email', read_only=True)
    user_full_name = serializers.CharField(source='user.get_full_name', read_only=True)
    opportunity_title = serializers.CharField(source='opportunity.title', read_only=True)

    class Meta:
        model = VolunteerSignup
        fields = [
            'id',
            'opportunity',
            'opportunity_title',
            'user',
            'user_email',
            'user_full_name',
            'message',
            'status',
            'signed_up_at',
        ]
        read_only_fields = ['status', 'signed_up_at']

    def validate_message(self, value):
        return sanitize(value)

    def validate(self, attrs):
        opportunity = attrs.get('opportunity')
        user = attrs.get('user')
        if VolunteerSignup.objects.filter(opportunity=opportunity, user=user).exists():
            raise serializers.ValidationError('You have already applied for this opportunity.')
        if not opportunity.is_active:
            raise serializers.ValidationError('This volunteer opportunity is no longer active.')
        if opportunity.slots is not None:
            accepted_count = opportunity.signups.filter(status='accepted').count()
            if accepted_count >= opportunity.slots:
                raise serializers.ValidationError(
                    'All slots for this opportunity have been filled.'
                )
        return attrs


# ---------------------------------------------------------------------------
# TeamMember
# ---------------------------------------------------------------------------

class TeamMemberSerializer(serializers.ModelSerializer):
    user_full_name = serializers.CharField(source='user.get_full_name', read_only=True)
    user_email = serializers.EmailField(source='user.email', read_only=True)

    class Meta:
        model = TeamMember
        fields = ['id', 'team', 'user', 'user_full_name', 'user_email', 'role', 'joined_at']
        read_only_fields = ['joined_at']

    def validate(self, attrs):
        team = attrs.get('team')
        user = attrs.get('user')
        if team and user and TeamMember.objects.filter(team=team, user=user).exists():
            raise serializers.ValidationError('This user is already a member of the team.')
        return attrs


# ---------------------------------------------------------------------------
# Team
# ---------------------------------------------------------------------------

class TeamSerializer(serializers.ModelSerializer):
    members = TeamMemberSerializer(many=True, read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    member_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Team
        fields = [
            'id',
            'name',
            'description',
            'created_by',
            'created_by_name',
            'opportunity',
            'created_at',
            'is_active',
            'members',
            'member_count',
        ]
        read_only_fields = ['created_by', 'created_at']

    def validate_name(self, value):
        return sanitize(value)

    def validate_description(self, value):
        return sanitize(value)
