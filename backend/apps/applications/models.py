from django.conf import settings
from django.db import models


class OpportunityApplication(models.Model):
    """A youth member's application to a scholarship or a job opportunity."""
    KIND_CHOICES = [('scholarship', 'Scholarship'), ('job', 'Job')]
    STATUS_CHOICES = [
        ('submitted', 'Submitted'), ('under_review', 'Under Review'),
        ('approved', 'Approved'), ('rejected', 'Rejected'),
    ]

    applicant = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='opportunity_applications')
    kind = models.CharField(max_length=15, choices=KIND_CHOICES)
    object_id = models.PositiveIntegerField()
    title = models.CharField(max_length=255)  # snapshot of scholarship / job title
    full_name = models.CharField(max_length=200)
    birthdate = models.DateField(null=True, blank=True)
    contact_number = models.CharField(max_length=30)
    email = models.EmailField()
    address = models.CharField(max_length=300)
    id_type = models.CharField(max_length=60, blank=True)
    id_number = models.CharField(max_length=60, blank=True)
    message = models.TextField(blank=True)
    confirmed_requirements = models.JSONField(default=list, blank=True)
    document = models.FileField(upload_to='applications/docs/', null=True, blank=True)
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='submitted')
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-submitted_at']
        unique_together = ('applicant', 'kind', 'object_id')

    def __str__(self):
        return f'{self.full_name} -> {self.title}'
