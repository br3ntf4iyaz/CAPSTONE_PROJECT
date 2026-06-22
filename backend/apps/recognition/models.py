from django.conf import settings
from django.db import models


class Badge(models.Model):
    CATEGORY_CHOICES = [
        ('course', 'Course'),
        ('governance', 'Governance'),
        ('internship', 'Internship'),
        ('project', 'Project'),
        ('volunteer', 'Volunteer'),
        ('special', 'Special'),
    ]

    name = models.CharField(max_length=255)
    description = models.TextField()
    icon = models.ImageField(upload_to='recognition/badges/', null=True, blank=True)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    criteria = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['category', 'name']

    def __str__(self):
        return self.name


class UserBadge(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='badges',
    )
    badge = models.ForeignKey(Badge, on_delete=models.CASCADE, related_name='user_badges')
    earned_at = models.DateTimeField(auto_now_add=True)
    awarded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='awarded_badges',
    )

    class Meta:
        ordering = ['-earned_at']
        unique_together = ('user', 'badge')

    def __str__(self):
        return f"{self.user} - {self.badge}"


class Certificate(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='certificates',
    )
    title = models.CharField(max_length=255)
    issued_by = models.CharField(max_length=255)
    issued_at = models.DateField()
    expiry_date = models.DateField(null=True, blank=True)
    certificate_number = models.CharField(max_length=100, unique=True)
    file = models.FileField(upload_to='recognition/certificates/', null=True, blank=True)
    enrollment = models.ForeignKey(
        'courses.Enrollment',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='certificates',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-issued_at']

    def __str__(self):
        return f"{self.title} - {self.user}"


class LeaderboardEntry(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='leaderboard_entry',
    )
    total_score = models.IntegerField(default=0)
    course_score = models.IntegerField(default=0)
    governance_score = models.IntegerField(default=0)
    project_score = models.IntegerField(default=0)
    volunteer_score = models.IntegerField(default=0)
    rank = models.IntegerField(null=True, blank=True)
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['rank', '-total_score']
        verbose_name = 'Leaderboard Entry'
        verbose_name_plural = 'Leaderboard Entries'

    def __str__(self):
        return f"{self.user} - Score: {self.total_score} (Rank: {self.rank})"


class Announcement(models.Model):
    title = models.CharField(max_length=255)
    content = models.TextField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='announcements',
    )
    is_published = models.BooleanField(default=False)
    published_at = models.DateTimeField(null=True, blank=True)
    target_roles = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title
