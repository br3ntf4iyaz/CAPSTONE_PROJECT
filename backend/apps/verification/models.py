import os
import uuid
from django.db import models
from django.conf import settings

from apps.accounts.storage import private_storage


def id_upload_path(instance, filename):
    ext = os.path.splitext(filename)[1]
    # Unguessable name (the folder is private too, this is defence in depth)
    return f"verification/{instance.user_id}/{uuid.uuid4().hex}{ext.lower()}"


class IDVerification(models.Model):
    class Status(models.TextChoices):
        PENDING   = "pending",   "Pending"
        REVIEWING = "reviewing", "Under review"
        APPROVED  = "approved",  "Approved"
        REJECTED  = "rejected",  "Rejected"

    class IDType(models.TextChoices):
        NATIONAL_ID      = "national_id",      "PhilSys National ID"
        DRIVERS_LICENSE  = "drivers_license",  "Driver's License"
        PASSPORT         = "passport",         "Passport"
        SSS              = "sss",              "SSS ID"
        UMID             = "umid",             "UMID"
        SCHOOL_ID        = "school_id",        "School ID"
        BARANGAY_ID      = "barangay_id",      "Barangay ID"
        VOTERS_ID        = "voters_id",        "Voter's ID"
        PHILHEALTH       = "philhealth",       "PhilHealth ID"
        POSTAL           = "postal",           "Postal ID"
        PRC              = "prc",              "PRC ID"
        OTHER_GOV        = "other_gov",        "Other government-issued ID"

    user      = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="id_verification",
    )
    id_type   = models.CharField(max_length=30, choices=IDType.choices)
    id_image  = models.ImageField(upload_to=id_upload_path, storage=private_storage, null=True, blank=True)
    id_back_image = models.ImageField(upload_to=id_upload_path, storage=private_storage, null=True, blank=True)
    selfie_image  = models.ImageField(upload_to=id_upload_path, storage=private_storage, null=True, blank=True)
    status    = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)

    # AI analysis results
    ai_verdict      = models.CharField(max_length=20, blank=True)   # approved / rejected
    ai_confidence   = models.FloatField(null=True, blank=True)       # 0–1
    ai_notes        = models.TextField(blank=True)
    ai_name_match   = models.BooleanField(null=True, blank=True)     # did name on ID match account?
    ai_face_match   = models.BooleanField(null=True, blank=True)     # does the live selfie match the ID photo?
    ai_raw_response = models.TextField(blank=True)

    # Automatic checks (all computed from the real submission, see decision.py)
    client_checks  = models.JSONField(default=dict, blank=True)    # what the camera measured on the device
    ocr_result     = models.JSONField(default=dict, blank=True)    # text read from the ID front
    image_checks   = models.JSONField(default=dict, blank=True)    # what the server measured on the saved photos
    decision_flags = models.JSONField(default=list, blank=True)    # reasons a submission needs a human
    auto_approved  = models.BooleanField(default=False)
    consent_at     = models.DateTimeField(null=True, blank=True)

    # Admin override
    admin_notes = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="verifications_reviewed",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)

    submitted_at = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-submitted_at"]

    def __str__(self):
        return f"{self.user.full_name} — {self.get_status_display()}"

    @property
    def is_verified(self):
        return self.status == self.Status.APPROVED


class IDTypeSetting(models.Model):
    """Which government IDs are accepted. LYDO admins can switch types on or off."""
    code       = models.CharField(max_length=30, unique=True)
    label      = models.CharField(max_length=80)
    is_enabled = models.BooleanField(default=True)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "label"]

    def __str__(self):
        return f"{self.label} ({'on' if self.is_enabled else 'off'})"
