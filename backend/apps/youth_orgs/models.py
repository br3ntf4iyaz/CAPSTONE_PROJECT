from django.db import models
from django.conf import settings


class YouthOrganization(models.Model):
    CLASS_CHOICES = [
        ('school_based', 'School-Based'),
        ('community_based', 'Community-Based'),
        ('faith_based', 'Faith-Based'),
    ]
    SUBCLASS_CHOICES = [
        ('sk_council', 'SK Council'),
        ('youth_org', 'Youth Organization (15-30)'),
        ('youth_serving', 'Youth Serving Organization (Mixed Ages)'),
    ]
    REG_CHOICES = [
        ('lydo', 'Lydo Registered'),
        ('nyc', 'NYC Registered'),
        ('not_registered', 'Not Yet Registered'),
    ]
    STATUS_CHOICES = [
        ('pending', 'Pending Review'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]

    name = models.CharField(max_length=200, unique=True)
    classification = models.CharField(max_length=30, choices=CLASS_CHOICES)
    sub_classification = models.CharField(max_length=30, choices=SUBCLASS_CHOICES)
    registration_category = models.CharField(
        max_length=20, choices=REG_CHOICES, default='not_registered'
    )
    barangay = models.CharField(max_length=100, blank=True)
    description = models.TextField(blank=True)
    contact_person = models.CharField(max_length=200, blank=True)
    contact_email = models.EmailField(blank=True)
    contact_phone = models.CharField(max_length=20, blank=True)
    logo = models.ImageField(upload_to='org_logos/', null=True, blank=True)
    is_active = models.BooleanField(default=True)
    is_compliant = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='submitted_orgs',
    )
    admin_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        indexes = [
            models.Index(fields=['classification']),
            models.Index(fields=['sub_classification']),
            models.Index(fields=['registration_category']),
            models.Index(fields=['barangay']),
            models.Index(fields=['is_active', 'is_compliant']),
        ]

    def __str__(self):
        return self.name


class OrgAccomplishment(models.Model):
    organization = models.ForeignKey(
        YouthOrganization,
        on_delete=models.CASCADE,
        related_name='accomplishments',
    )
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    date_achieved = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date_achieved', '-created_at']
        indexes = [
            models.Index(fields=['organization', 'date_achieved']),
        ]

    def __str__(self):
        return f'{self.organization.name} — {self.title}'


class OrgRequirement(models.Model):
    organization = models.ForeignKey(
        YouthOrganization,
        on_delete=models.CASCADE,
        related_name='requirements',
    )
    name = models.CharField(max_length=200)
    is_submitted = models.BooleanField(default=False)
    file = models.FileField(upload_to='org_requirements/', null=True, blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['name']
        indexes = [
            models.Index(fields=['organization', 'is_submitted']),
        ]

    def __str__(self):
        status = 'Submitted' if self.is_submitted else 'Pending'
        return f'{self.organization.name} — {self.name} ({status})'
