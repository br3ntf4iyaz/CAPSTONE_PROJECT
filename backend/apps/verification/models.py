import os
from django.db import models
from django.conf import settings


def id_upload_path(instance, filename):
    ext = os.path.splitext(filename)[1]
    return f"verification/{instance.user_id}{ext}"


class IDVerification(models.Model):
    class Status(models.TextChoices):
        PENDING   = "pending",   "Pending"
        REVIEWING = "reviewing", "AI Reviewing"
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

    user      = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="id_verification",
    )
    id_type   = models.CharField(max_length=30, choices=IDType.choices)
    id_image  = models.ImageField(upload_to=id_upload_path, null=True, blank=True)
    status    = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)

    # AI analysis results
    ai_verdict      = models.CharField(max_length=20, blank=True)   # approved / rejected
    ai_confidence   = models.FloatField(null=True, blank=True)       # 0–1
    ai_notes        = models.TextField(blank=True)
    ai_name_match   = models.BooleanField(null=True, blank=True)     # did name on ID match account?
    ai_raw_response = models.TextField(blank=True)

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
