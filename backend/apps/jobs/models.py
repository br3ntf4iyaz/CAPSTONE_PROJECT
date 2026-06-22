from django.db import models
from django.conf import settings


class JobOpportunity(models.Model):
    JOB_TYPES = [
        ('full_time', 'Full Time'),
        ('part_time', 'Part Time'),
        ('contract', 'Contract'),
        ('internship', 'Internship'),
        ('volunteer', 'Volunteer'),
    ]
    INDUSTRIES = [
        ('government', 'Government'),
        ('private', 'Private Sector'),
        ('ngo', 'NGO/Non-Profit'),
        ('education', 'Education'),
        ('health', 'Health'),
        ('tech', 'Technology'),
        ('other', 'Other'),
    ]

    title = models.CharField(max_length=200)
    company_or_org = models.CharField(max_length=200)
    location = models.CharField(max_length=200)
    job_type = models.CharField(max_length=20, choices=JOB_TYPES)
    industry = models.CharField(max_length=20, choices=INDUSTRIES)
    description = models.TextField()
    requirements = models.TextField(blank=True)
    salary_range = models.CharField(max_length=100, blank=True)
    application_deadline = models.DateField(null=True, blank=True)
    application_link = models.URLField(blank=True)
    contact_email = models.EmailField(blank=True)
    posted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='job_postings',
    )
    is_active = models.BooleanField(default=True)
    is_featured = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_featured', '-created_at']
        indexes = [
            models.Index(fields=['job_type']),
            models.Index(fields=['industry']),
            models.Index(fields=['is_active', 'is_featured']),
            models.Index(fields=['application_deadline']),
        ]

    def __str__(self):
        return f'{self.title} — {self.company_or_org} ({self.get_job_type_display()})'


class SavedJob(models.Model):
    """Youth user bookmarks a job / scholarship posting."""
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='saved_jobs',
    )
    job = models.ForeignKey(
        JobOpportunity,
        on_delete=models.CASCADE,
        related_name='saved_by',
    )
    saved_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'job')
        ordering = ['-saved_at']

    def __str__(self):
        return f'{self.user} saved {self.job.title}'
