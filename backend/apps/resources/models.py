from django.conf import settings
from django.db import models


class Scholarship(models.Model):
    PROVIDER_TYPE_CHOICES = [
        ('government', 'Government'),
        ('local_government', 'Local Government'),
        ('private', 'Private'),
        ('ngo', 'NGO'),
    ]

    CATEGORY_CHOICES = [
        ('tuition', 'Tuition Grant'),
        ('stem', 'STEM / Science'),
        ('vocational', 'Vocational / TESDA'),
        ('youth_leadership', 'Youth Leadership'),
        ('board_exam', 'Board Exam Review'),
        ('private', 'Private Sector'),
        ('loan', 'Educational Loan'),
        ('assistance', 'Financial Assistance'),
        ('other', 'Other'),
    ]

    title = models.CharField(max_length=255)
    provider = models.CharField(max_length=255)
    provider_type = models.CharField(max_length=20, choices=PROVIDER_TYPE_CHOICES)
    description = models.TextField(blank=True)
    coverage = models.CharField(max_length=255)
    amount = models.CharField(max_length=100)
    deadline = models.CharField(max_length=50, blank=True, help_text='e.g. "Rolling", "2026-06-30", or blank for TBD')
    slots = models.CharField(max_length=100)
    requirements = models.JSONField(default=list, blank=True)
    application_url = models.URLField(max_length=500, blank=True)
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES, default='other')
    is_published = models.BooleanField(default=True)
    is_featured = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='scholarships_created',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_featured', 'title']

    def __str__(self):
        return self.title


class Resource(models.Model):
    RESOURCE_TYPE_CHOICES = [
        ('document', 'Document'),
        ('video', 'Video'),
        ('link', 'Link'),
        ('form', 'Form'),
    ]

    CATEGORY_CHOICES = [
        ('leadership', 'Leadership'),
        ('governance', 'Governance'),
        ('legal', 'Legal'),
        ('financial', 'Financial'),
        ('health', 'Health'),
        ('education', 'Education'),
        ('other', 'Other'),
    ]

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    resource_type = models.CharField(max_length=20, choices=RESOURCE_TYPE_CHOICES)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    law_number = models.CharField(max_length=50, blank=True, help_text='e.g. RA 10742, EO 123, DILG MC 2020-091')
    year_enacted = models.PositiveIntegerField(null=True, blank=True)
    tags = models.CharField(max_length=500, blank=True, help_text='Comma-separated tags')
    file = models.FileField(upload_to='resources/files/', null=True, blank=True)
    external_url = models.URLField(max_length=1000, blank=True)
    thumbnail = models.ImageField(upload_to='resources/thumbnails/', null=True, blank=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='uploaded_resources',
    )
    is_published = models.BooleanField(default=False)
    is_featured = models.BooleanField(default=False)
    download_count = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title
