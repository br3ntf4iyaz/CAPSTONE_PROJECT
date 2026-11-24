from django.conf import settings
from django.db import models

import os
import uuid

from apps.accounts.storage import private_storage


def application_doc_path(instance, filename):
    return f"applications/docs/{uuid.uuid4().hex}{os.path.splitext(filename)[1].lower()}"


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
    document = models.FileField(upload_to=application_doc_path, storage=private_storage, null=True, blank=True)  # the resume, for jobs
    id_document = models.FileField(upload_to=application_doc_path, storage=private_storage, null=True, blank=True)  # the FRONT of the valid ID, taken with the camera
    id_document_back = models.FileField(upload_to=application_doc_path, storage=private_storage, null=True, blank=True)  # the BACK of the valid ID
    selfie = models.FileField(upload_to=application_doc_path, storage=private_storage, null=True, blank=True)  # live selfie for the face check
    face_check = models.JSONField(default=dict, blank=True)  # what the applicant's device measured (face distance, live capture); the reviewer still compares the faces
    resubmit_count = models.PositiveSmallIntegerField(default=0)
    previous_note = models.TextField(blank=True)  # the reason LYDO gave the last time it was not accepted
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='submitted')
    submitted_at = models.DateTimeField(auto_now_add=True)
    admin_note = models.TextField(blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-submitted_at']
        unique_together = ('applicant', 'kind', 'object_id')

    def __str__(self):
        return f'{self.full_name} -> {self.title}'


def scholarship_doc_path(instance, filename):
    return f"applications/scholarship/{uuid.uuid4().hex}{os.path.splitext(filename)[1].lower()}"


class ScholarshipApplication(models.Model):
    """A full online scholarship application: form answers, documents and review progress."""
    STATUS_CHOICES = [
        ('submitted', 'Submitted'), ('under_review', 'Under Review'), ('for_compliance', 'For Compliance'),
        ('approved', 'Approved'), ('rejected', 'Rejected'), ('withdrawn', 'Withdrawn'),
    ]

    reference_number = models.CharField(max_length=24, unique=True, editable=False)
    applicant = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='scholarship_applications')
    scholarship = models.ForeignKey('resources.Scholarship', on_delete=models.PROTECT, related_name='applications')
    scholarship_title = models.CharField(max_length=255)  # snapshot, so records stay readable if the listing changes
    personal = models.JSONField(default=dict)
    education = models.JSONField(default=dict)
    family = models.JSONField(default=dict)
    consent_given = models.BooleanField(default=False)
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='submitted')
    admin_remarks = models.TextField(blank=True)
    applicant_message = models.TextField(blank=True)  # reply when complying with a request
    submitted_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-submitted_at']
        constraints = [models.UniqueConstraint(fields=['applicant', 'scholarship'], name='one_application_per_scholarship')]

    def __str__(self):
        return f'{self.reference_number} {self.scholarship_title}'


class ScholarshipApplicationDocument(models.Model):
    application = models.ForeignKey(ScholarshipApplication, on_delete=models.CASCADE, related_name='documents')
    doc_type = models.CharField(max_length=30)
    original_name = models.CharField(max_length=255)
    file = models.FileField(upload_to=scholarship_doc_path, storage=private_storage)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['id']
