from django.db import models
from django.conf import settings


class Internship(models.Model):
    MODE_CHOICES = [
        ('onsite', 'On-site'),
        ('remote', 'Remote'),
        ('hybrid', 'Hybrid'),
    ]

    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('open', 'Open'),
        ('closed', 'Closed'),
    ]

    title = models.CharField(max_length=255)
    description = models.TextField()
    organization = models.CharField(max_length=255)
    location = models.CharField(max_length=255, blank=True)
    mode = models.CharField(max_length=20, choices=MODE_CHOICES, default='onsite')
    posted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='internships_posted',
    )
    slots = models.PositiveIntegerField(default=1)
    requirements = models.TextField(blank=True)
    eligibility_badges = models.ManyToManyField(
        'recognition.Badge',
        blank=True,
        related_name='internship_eligibility',
    )
    required_courses = models.ManyToManyField(
        'courses.Course',
        blank=True,
        related_name='internship_requirements',
    )
    deadline = models.DateField(null=True, blank=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    is_featured = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)  # soft delete
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'is_active']),
            models.Index(fields=['is_featured']),
            models.Index(fields=['deadline']),
            models.Index(fields=['organization']),
        ]

    def __str__(self):
        return f'{self.title} @ {self.organization} ({self.get_status_display()})'


class InternshipApplication(models.Model):
    STATUS_CHOICES = [
        ('submitted', 'Submitted'),
        ('under_review', 'Under Review'),
        ('shortlisted', 'Shortlisted'),
        ('interview_scheduled', 'Interview Scheduled'),
        ('accepted', 'Accepted'),
        ('rejected', 'Rejected'),
        ('completed', 'Completed'),
    ]

    applicant = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='internship_applications',
    )
    internship = models.ForeignKey(
        Internship,
        on_delete=models.CASCADE,
        related_name='applications',
    )
    cover_letter = models.TextField(blank=True)
    resume = models.FileField(upload_to='internships/resumes/', null=True, blank=True)
    status = models.CharField(max_length=25, choices=STATUS_CHOICES, default='submitted')
    submitted_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    interview_date = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)  # admin only

    class Meta:
        ordering = ['-submitted_at']
        unique_together = ('applicant', 'internship')
        indexes = [
            models.Index(fields=['internship', 'status']),
            models.Index(fields=['applicant', 'status']),
        ]

    def __str__(self):
        return (
            f'{self.applicant} → {self.internship.title} '
            f'({self.get_status_display()})'
        )


class InternshipRequirement(models.Model):
    internship = models.ForeignKey(
        Internship,
        on_delete=models.CASCADE,
        related_name='structured_requirements',
    )
    requirement = models.CharField(max_length=200)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f'{self.internship.title}: {self.requirement}'
