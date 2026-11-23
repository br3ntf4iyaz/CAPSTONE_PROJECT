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
    # Online application settings (managed by LYDO admins)
    eligibility = models.JSONField(default=list, blank=True)           # list of qualification sentences
    instructions = models.TextField(blank=True)                        # how to apply
    required_documents = models.JSONField(default=list, blank=True)    # keys from DOCUMENT_TYPES that must be uploaded
    optional_documents = models.JSONField(default=list, blank=True)    # keys the applicant may upload
    requires_gwa = models.BooleanField(default=False)
    opens_on = models.DateField(null=True, blank=True)
    closes_on = models.DateField(null=True, blank=True)
    accepting_applications = models.BooleanField(default=True)
    is_sample = models.BooleanField(default=False, help_text='Demonstration record, not verified information')
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

    MATERIAL_TYPE_CHOICES = [
        ('pdf', 'PDF'), ('article', 'Article'), ('website', 'Website'), ('handbook', 'Handbook'),
        ('guide', 'Guide'), ('video', 'Video'), ('learning', 'Learning Material'),
    ]

    SOURCE_KIND_CHOICES = [
        ('government', 'Official Philippine government publication'),
        ('international', 'International organization'),
        ('institution', 'Educational or research institution'),
        ('other', 'Third-party material'),
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
    # Library details (all optional; never filled with guesses)
    author = models.CharField(max_length=255, blank=True, help_text='Author or publishing organization')
    source_url = models.URLField(max_length=1000, blank=True, help_text='The official page where this material is published')
    download_url = models.URLField(max_length=1000, blank=True, help_text='Direct link to an official downloadable file')
    material_type = models.CharField(max_length=20, choices=MATERIAL_TYPE_CHOICES, blank=True)
    source_kind = models.CharField(max_length=20, choices=SOURCE_KIND_CHOICES, blank=True)
    status_note = models.CharField(max_length=255, blank=True, help_text='e.g. "Updated by JMC No. 1, s. 2025"')
    verified_on = models.DateField(null=True, blank=True, help_text='Last date the link was checked')
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
