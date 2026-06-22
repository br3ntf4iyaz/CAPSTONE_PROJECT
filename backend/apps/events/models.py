from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator


class Event(models.Model):
    EVENT_TYPE_CHOICES = [
        ('webinar', 'Webinar'),
        ('town_hall', 'Town Hall'),
        ('workshop', 'Workshop'),
        ('consultation', 'Consultation'),
        ('training', 'Training'),
        ('other', 'Other'),
    ]

    title = models.CharField(max_length=255)
    description = models.TextField()
    event_type = models.CharField(max_length=20, choices=EVENT_TYPE_CHOICES, default='other')
    organizer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='events_organized',
    )
    location = models.CharField(max_length=255, blank=True)
    meeting_link = models.URLField(blank=True)
    thumbnail = models.ImageField(upload_to='events/thumbnails/', null=True, blank=True)
    start_datetime = models.DateTimeField()
    end_datetime = models.DateTimeField()
    capacity = models.PositiveIntegerField(null=True, blank=True)
    is_published = models.BooleanField(default=False)
    is_featured = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)  # soft delete
    check_in_active = models.BooleanField(default=False)
    check_in_code = models.CharField(max_length=6, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['start_datetime']
        indexes = [
            models.Index(fields=['event_type']),
            models.Index(fields=['is_published', 'is_active']),
            models.Index(fields=['start_datetime', 'end_datetime']),
        ]

    def __str__(self):
        return f'{self.title} ({self.get_event_type_display()}) — {self.start_datetime.strftime("%Y-%m-%d")}'


class EventRegistration(models.Model):
    event = models.ForeignKey(
        Event,
        on_delete=models.CASCADE,
        related_name='registrations',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='event_registrations',
    )
    registered_at = models.DateTimeField(auto_now_add=True)
    attended = models.BooleanField(default=False)

    class Meta:
        ordering = ['-registered_at']
        unique_together = ('event', 'user')
        indexes = [
            models.Index(fields=['event', 'attended']),
            models.Index(fields=['user']),
        ]

    def __str__(self):
        attended_label = 'attended' if self.attended else 'registered'
        return f'{self.user} — {self.event.title} ({attended_label})'


class Poll(models.Model):
    event = models.ForeignKey(
        Event,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='polls',
    )
    question = models.CharField(max_length=500)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='polls_created',
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    ends_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['event', 'is_active']),
            models.Index(fields=['ends_at']),
        ]

    def __str__(self):
        return self.question[:80]


class PollOption(models.Model):
    poll = models.ForeignKey(
        Poll,
        on_delete=models.CASCADE,
        related_name='options',
    )
    text = models.CharField(max_length=200)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order']
        indexes = [
            models.Index(fields=['poll', 'order']),
        ]

    def __str__(self):
        return f'[{self.poll.id}] Option {self.order}: {self.text}'


class PollResponse(models.Model):
    poll = models.ForeignKey(
        Poll,
        on_delete=models.CASCADE,
        related_name='responses',
    )
    option = models.ForeignKey(
        PollOption,
        on_delete=models.CASCADE,
        related_name='responses',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='poll_responses',
    )
    responded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-responded_at']
        unique_together = ('poll', 'user')
        indexes = [
            models.Index(fields=['poll', 'option']),
        ]

    def __str__(self):
        return f'{self.user} chose "{self.option.text}" on poll {self.poll.id}'


class Survey(models.Model):
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    event = models.ForeignKey(
        Event,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='surveys',
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='surveys_created',
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['event', 'is_active']),
        ]

    def __str__(self):
        return self.title


class SurveyQuestion(models.Model):
    QUESTION_TYPE_CHOICES = [
        ('text', 'Text'),
        ('rating', 'Rating (1–5)'),
        ('scale', 'Scale (1–10)'),
        ('multiple_choice', 'Multiple Choice'),
        ('yes_no', 'Yes / No'),
        ('number', 'Number'),
    ]

    survey = models.ForeignKey(
        Survey,
        on_delete=models.CASCADE,
        related_name='questions',
    )
    question = models.TextField()
    question_type = models.CharField(
        max_length=20,
        choices=QUESTION_TYPE_CHOICES,
        default='multiple_choice',
    )
    choices = models.JSONField(default=list, blank=True)  # list of str for multiple_choice
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order']
        indexes = [
            models.Index(fields=['survey', 'order']),
        ]

    def __str__(self):
        snippet = self.question[:60] + ('...' if len(self.question) > 60 else '')
        return f'[{self.get_question_type_display()}] {snippet}'


class SurveyResponse(models.Model):
    survey = models.ForeignKey(
        Survey,
        on_delete=models.CASCADE,
        related_name='responses',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='survey_responses',
    )
    answers = models.JSONField(default=dict)
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-submitted_at']
        unique_together = ('survey', 'user')
        indexes = [
            models.Index(fields=['survey']),
            models.Index(fields=['user']),
        ]

    def __str__(self):
        return f'{self.user} — Survey: {self.survey.title}'


class Feedback(models.Model):
    event = models.ForeignKey(
        Event,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='feedback_entries',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='feedback_given',
    )
    rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
    )
    comment = models.TextField(blank=True)
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-submitted_at']
        indexes = [
            models.Index(fields=['event', 'rating']),
            models.Index(fields=['user']),
        ]

    def __str__(self):
        event_label = self.event.title if self.event else 'General'
        return f'{self.user} — {event_label}: {self.rating}/5'


class FeaturedPost(models.Model):
    class PostType(models.TextChoices):
        NEWS = 'news', 'News'
        UPDATE = 'update', 'Update'
        YOUTH_INFO = 'youth_info', 'Youth Info'
        LOCAL_EVENT = 'local_event', 'Local Event (Past)'
        NATIONAL_EVENT = 'national_event', 'National Event (Past)'

    title = models.CharField(max_length=255)
    content = models.TextField()
    post_type = models.CharField(max_length=20, choices=PostType.choices, default=PostType.NEWS)
    thumbnail = models.ImageField(upload_to='featured/', null=True, blank=True)
    source = models.CharField(max_length=200, blank=True, help_text="Source or organizer")
    date_of_event = models.DateField(null=True, blank=True, help_text="Date of the event/news")
    is_published = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0, help_text="Lower = shown first")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='featured_posts',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['order', '-created_at']

    def __str__(self):
        return f'[{self.get_post_type_display()}] {self.title}'
