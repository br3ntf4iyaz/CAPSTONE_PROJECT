import bleach
from datetime import date
from rest_framework import serializers

from .models import JobOpportunity, SavedJob

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
# JobOpportunity — List
# ---------------------------------------------------------------------------

def _deadline_status(deadline_date):
    if not deadline_date:
        return 'none'
    today = date.today()
    if deadline_date < today:
        return 'closed'
    delta = (deadline_date - today).days
    if delta <= 7:
        return 'soon'
    return 'open'


class JobListSerializer(serializers.ModelSerializer):
    job_type_display = serializers.CharField(source='get_job_type_display', read_only=True)
    industry_display = serializers.CharField(source='get_industry_display', read_only=True)
    is_saved = serializers.SerializerMethodField()
    deadline_status = serializers.SerializerMethodField()

    class Meta:
        model = JobOpportunity
        fields = [
            'id',
            'title',
            'company_or_org',
            'location',
            'job_type',
            'job_type_display',
            'industry',
            'industry_display',
            'salary_range',
            'application_deadline',
            'is_featured',
            'is_saved',
            'deadline_status',
            'created_at',
        ]

    def get_is_saved(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return SavedJob.objects.filter(user=request.user, job=obj).exists()
        return False

    def get_deadline_status(self, obj):
        return _deadline_status(obj.application_deadline)


# ---------------------------------------------------------------------------
# JobOpportunity — Detail
# ---------------------------------------------------------------------------

class JobDetailSerializer(serializers.ModelSerializer):
    job_type_display = serializers.CharField(source='get_job_type_display', read_only=True)
    industry_display = serializers.CharField(source='get_industry_display', read_only=True)
    posted_by_email = serializers.EmailField(
        source='posted_by.email', read_only=True, default=None
    )
    is_saved = serializers.SerializerMethodField()
    deadline_status = serializers.SerializerMethodField()

    class Meta:
        model = JobOpportunity
        fields = [
            'id',
            'title',
            'company_or_org',
            'location',
            'job_type',
            'job_type_display',
            'industry',
            'industry_display',
            'description',
            'requirements',
            'salary_range',
            'application_deadline',
            'application_link',
            'contact_email',
            'posted_by',
            'posted_by_email',
            'is_active',
            'is_featured',
            'is_saved',
            'deadline_status',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['posted_by', 'created_at', 'updated_at']

    def get_is_saved(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return SavedJob.objects.filter(user=request.user, job=obj).exists()
        return False

    def get_deadline_status(self, obj):
        return _deadline_status(obj.application_deadline)

    def validate_description(self, value):
        return sanitize(value)

    def validate_requirements(self, value):
        return sanitize(value)
