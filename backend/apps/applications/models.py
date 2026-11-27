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
        ('approved', 'Approved'), ('rejected', 'Rejected'), ('revoked', 'Approval Revoked'),
    ]
    AI_STATUS_CHOICES = [
        ('pending', 'Waiting for AI screening'), ('processing', 'AI screening'), ('done', 'AI screening done'),
        ('failed', 'AI screening failed'), ('unavailable', 'AI screening unavailable'),
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
    admin_note = models.TextField(blank=True)  # the reason or note the APPLICANT can read
    reviewed_at = models.DateTimeField(null=True, blank=True)

    # --- AI screening: an assistance only. It is kept apart from the administrator's decision (status) ---
    ai_status = models.CharField(max_length=15, choices=AI_STATUS_CHOICES, default='pending')
    ai_results = models.JSONField(default=dict, blank=True)  # per document: status + plain-language finding
    ai_attempts = models.PositiveSmallIntegerField(default=0)
    ai_started_at = models.DateTimeField(null=True, blank=True)
    ai_completed_at = models.DateTimeField(null=True, blank=True)
    file_names = models.JSONField(default=dict, blank=True)  # original file names, by requirement

    # --- what the administrator did: opened is not verified ---
    opened_docs = models.JSONField(default=dict, blank=True)  # requirement -> when an admin first opened it
    manual_checks = models.JSONField(default=dict, blank=True)  # the boxes the administrator ticked by hand
    ai_override_note = models.TextField(blank=True)  # why the admin approved although the AI flagged a requirement
    rejected_items = models.JSONField(default=list, blank=True)  # which requirements were invalid or missing
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    approved_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    revoked_at = models.DateTimeField(null=True, blank=True)
    revoked_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    revocation_reason = models.TextField(blank=True)

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
    # valid ID details (only the kind of ID, never its number) and how the copy was made
    id_type = models.CharField(max_length=20, blank=True)
    id_type_other = models.CharField(max_length=60, blank=True)
    source = models.CharField(max_length=10, blank=True)  # 'camera' or 'upload'
    # LYDO's decision about this one document, and the note the applicant reads
    review_status = models.CharField(max_length=15, default='pending')
    review_note = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    reviewed_at = models.DateTimeField(null=True, blank=True)
    # replaced by a newer copy: kept for the history, no longer the current one
    superseded = models.BooleanField(default=False)

    class Meta:
        ordering = ['id']
