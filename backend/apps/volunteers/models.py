from django.conf import settings
from django.db import models


class VolunteerOpportunity(models.Model):
    title = models.CharField(max_length=255)
    description = models.TextField()
    organization = models.CharField(max_length=255)
    location = models.CharField(max_length=255)
    event = models.ForeignKey(
        'events.Event',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='volunteer_opportunities',
    )
    tags = models.JSONField(default=list)
    slots = models.IntegerField(null=True, blank=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    posted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='posted_opportunities',
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Volunteer Opportunity'
        verbose_name_plural = 'Volunteer Opportunities'

    def __str__(self):
        return self.title


class VolunteerSignup(models.Model):
    STATUS_CHOICES = [
        ('applied', 'Applied'),
        ('accepted', 'Accepted'),
        ('rejected', 'Rejected'),
        ('completed', 'Completed'),
    ]

    opportunity = models.ForeignKey(
        VolunteerOpportunity,
        on_delete=models.CASCADE,
        related_name='signups',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='volunteer_signups',
    )
    message = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='applied')
    signed_up_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-signed_up_at']
        unique_together = ('opportunity', 'user')

    def __str__(self):
        return f"{self.user} - {self.opportunity} ({self.status})"


class Team(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_teams',
    )
    opportunity = models.ForeignKey(
        VolunteerOpportunity,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='teams',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class TeamMember(models.Model):
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name='members')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='team_memberships',
    )
    role = models.CharField(max_length=100, blank=True)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['joined_at']
        unique_together = ('team', 'user')

    def __str__(self):
        return f"{self.user} - {self.team}"
