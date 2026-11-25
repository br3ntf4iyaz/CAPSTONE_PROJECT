from django.conf import settings
from django.db import models


class Notification(models.Model):
    NOTIFICATION_TYPE_CHOICES = [
        ('course', 'Course'),
        ('badge', 'Badge'),
        ('internship', 'Internship'),
        ('event', 'Event'),
        ('project', 'Project'),
        ('announcement', 'Announcement'),
        ('system', 'System'),
        ('community_comment', 'Community comment'),
        ('community_reaction', 'Community reaction'),
        ('community_reply', 'Community reply'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications',
    )
    title = models.CharField(max_length=255)
    message = models.TextField()
    notification_type = models.CharField(max_length=20, choices=NOTIFICATION_TYPE_CHOICES)
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    link = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    # Community Feed activity: who did it and which post/comment it is about.
    # The ids are plain numbers (not foreign keys) so a deleted post can never break the notification.
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='+',
    )
    post_id = models.PositiveIntegerField(null=True, blank=True, db_index=True)
    comment_id = models.PositiveIntegerField(null=True, blank=True)
    reaction_type = models.CharField(max_length=10, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} -> {self.user} ({'read' if self.is_read else 'unread'})"


class BroadcastNotification(models.Model):
    """
    Records every admin-initiated broadcast (in-app + optional email).

    One row per send action — not per recipient.
    Individual Notification rows are created for each recipient's inbox.
    """
    AUDIENCE_CHOICES = [
        ('all', 'All Users'),
        ('sk', 'SK Only'),
        ('youth_leaders', 'Youth Leaders'),
        ('general', 'General Youth'),
        ('lgu_admin', 'LGU Admins'),
    ]

    title = models.CharField(max_length=120)
    message = models.TextField()
    target_audience = models.CharField(max_length=20, choices=AUDIENCE_CHOICES, default='all')
    via_email = models.BooleanField(default=False)
    recipient_count = models.PositiveIntegerField(default=0)
    email_sent_count = models.PositiveIntegerField(default=0)
    sent_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='broadcasts_sent',
    )
    sent_at = models.DateTimeField(auto_now_add=True)
    attachment = models.FileField(
        upload_to='notification_attachments/',
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ['-sent_at']

    def __str__(self):
        return f"{self.title} → {self.get_target_audience_display()} ({self.sent_at.strftime('%Y-%m-%d')})"
