import os
import uuid

from django.conf import settings
from django.db import models

from apps.accounts.storage import private_storage


LUCENA_BARANGAYS = [
    ('brgy_1', 'Barangay 1 (Poblacion)'),
    ('brgy_2', 'Barangay 2 (Poblacion)'),
    ('brgy_3', 'Barangay 3 (Poblacion)'),
    ('brgy_4', 'Barangay 4 (Poblacion)'),
    ('brgy_5', 'Barangay 5 (Poblacion)'),
    ('brgy_6', 'Barangay 6 (Poblacion)'),
    ('brgy_7', 'Barangay 7 (Poblacion)'),
    ('brgy_8', 'Barangay 8 (Poblacion)'),
    ('brgy_9', 'Barangay 9 (Poblacion)'),
    ('brgy_10', 'Barangay 10 (Poblacion)'),
    ('brgy_11', 'Barangay 11 (Poblacion)'),
    ('barra', 'Barra'),
    ('bocohan', 'Bocohan'),
    ('cotta', 'Cotta'),
    ('gulang_gulang', 'Gulang-Gulang'),
    ('dalahican', 'Dalahican'),
    ('domoit', 'Domoit'),
    ('ibabang_dupay', 'Ibabang Dupay'),
    ('ibabang_iyam', 'Ibabang Iyam'),
    ('ibabang_talim', 'Ibabang Talim'),
    ('ilayang_dupay', 'Ilayang Dupay'),
    ('ilayang_iyam', 'Ilayang Iyam'),
    ('ilayang_talim', 'Ilayang Talim'),
    ('isabang', 'Isabang'),
    ('market_view', 'Market View'),
    ('mayao_castillo', 'Mayao Castillo'),
    ('mayao_crossing', 'Mayao Crossing'),
    ('mayao_kanluran', 'Mayao Kanluran'),
    ('mayao_parada', 'Mayao Parada'),
    ('mayao_silangan', 'Mayao Silangan'),
    ('ransohan', 'Ransohan'),
    ('salinas', 'Salinas'),
    ('talao_talao', 'Talao-Talao'),
]

BARANGAY_KEYS = [b[0] for b in LUCENA_BARANGAYS]


class ComplianceRecord(models.Model):
    RECORD_TYPE_CHOICES = [
        ('event_attendance', 'Event Attendance'),
        ('course_completion', 'Course Completion'),
        ('project_contribution', 'Project Contribution'),
        ('volunteer_activity', 'Volunteer Activity'),
        ('internship_completion', 'Internship Completion'),
        ('governance_participation', 'Governance Participation'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='compliance_records',
    )
    record_type = models.CharField(max_length=30, choices=RECORD_TYPE_CHOICES)
    value = models.IntegerField(default=1)
    description = models.CharField(max_length=500, blank=True)
    reference_id = models.IntegerField(null=True, blank=True)
    recorded_at = models.DateTimeField(auto_now_add=True)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='recorded_compliance_records',
    )

    class Meta:
        ordering = ['-recorded_at']

    def __str__(self):
        return f"{self.user} - {self.get_record_type_display()} ({self.recorded_at.date()})"


class ComplianceReport(models.Model):
    REPORT_TYPE_CHOICES = [
        ('individual', 'Individual'),
        ('barangay', 'Barangay'),
        ('municipal', 'Municipal'),
        ('summary', 'Summary'),
    ]

    generated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='generated_compliance_reports',
    )
    barangay = models.CharField(max_length=255, blank=True)
    date_from = models.DateField()
    date_to = models.DateField()
    data = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    report_type = models.CharField(max_length=20, choices=REPORT_TYPE_CHOICES)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return (
            f"{self.get_report_type_display()} Report "
            f"({self.date_from} to {self.date_to}) by {self.generated_by}"
        )


class SKMECompliance(models.Model):
    ME_STATUS = [('yes', 'Yes'), ('partial', 'Partial'), ('no', 'No')]
    barangay = models.CharField(max_length=50, choices=LUCENA_BARANGAYS)
    year = models.IntegerField(default=2025)
    me1_ppa = models.CharField(max_length=10, choices=ME_STATUS, default='no')
    me1_gap = models.CharField(max_length=10, choices=ME_STATUS, default='no')
    me2_policies = models.CharField(max_length=10, choices=ME_STATUS, default='no')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('barangay', 'year')
        ordering = ['barangay']

    def __str__(self):
        return f"ME - {self.get_barangay_display()} ({self.year})"


class SKDocumentSubmission(models.Model):
    DOC_STATUS = [('submitted', 'Submitted'), ('partial', 'Partially Submitted'), ('not_submitted', 'Not Submitted')]
    barangay = models.CharField(max_length=50, choices=LUCENA_BARANGAYS)
    year = models.IntegerField(default=2025)
    minutes_status = models.CharField(max_length=20, choices=DOC_STATUS, default='not_submitted')
    minutes_count = models.IntegerField(null=True, blank=True)
    sk_directory_status = models.CharField(max_length=20, choices=DOC_STATUS, default='not_submitted')
    youth_org_list_status = models.CharField(max_length=20, choices=DOC_STATUS, default='not_submitted')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('barangay', 'year')
        ordering = ['barangay']

    def __str__(self):
        return f"Docs - {self.get_barangay_display()} ({self.year})"


class SKAssemblyRecord(models.Model):
    ASSEMBLY_STATUS = [('conducted', 'Conducted'), ('not_conducted', 'Not Conducted'), ('pending', 'Pending')]
    barangay = models.CharField(max_length=50, choices=LUCENA_BARANGAYS)
    year = models.IntegerField(default=2025)
    kk_1st_sem = models.CharField(max_length=20, choices=ASSEMBLY_STATUS, default='pending')
    kk_2nd_sem = models.CharField(max_length=20, choices=ASSEMBLY_STATUS, default='pending')
    lnk = models.CharField(max_length=20, choices=ASSEMBLY_STATUS, default='pending')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('barangay', 'year')
        ordering = ['barangay']

    def __str__(self):
        return f"Assembly - {self.get_barangay_display()} ({self.year})"


# ─── Full Public Disclosure (FPDPB) ──────────────────────────────────────────

class DisclosureRequirement(models.Model):
    """A document that must be disclosed on a schedule (one row of the FPDPB checklist).

    Quarterly requirements follow the fixed deadlines in disclosure.py (April 7, July 7, October 7 and January 7).
    Annual requirements may have a deadline the administrator sets (month and day); with none, they are never overdue.
    """
    FREQUENCY_CHOICES = [('quarterly', 'Quarterly'), ('annual', 'Annual')]

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    frequency = models.CharField(max_length=10, choices=FREQUENCY_CHOICES, default='quarterly')
    deadline_month = models.PositiveSmallIntegerField(null=True, blank=True, help_text='Annual only: month of the yearly deadline (1-12).')
    deadline_day = models.PositiveSmallIntegerField(null=True, blank=True, help_text='Annual only: day of the yearly deadline.')
    order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'id']

    def __str__(self):
        return self.title


def disclosure_upload_path(instance, filename):
    ext = os.path.splitext(filename or '')[1].lower()
    return f'disclosure/{instance.year}/{instance.requirement_id}/{uuid.uuid4().hex}{ext}'


class DisclosureSubmission(models.Model):
    """One uploaded document for one reporting period. Uploads are never overwritten: a new upload is a new row, so the
    full history is kept. A period only counts as completed when one of its uploads has been VERIFIED by an administrator."""
    STATUS_CHOICES = [('uploaded', 'Uploaded, waiting for verification'), ('verified', 'Verified'), ('rejected', 'Rejected')]

    requirement = models.ForeignKey(DisclosureRequirement, on_delete=models.PROTECT, related_name='submissions')
    year = models.PositiveSmallIntegerField()
    quarter = models.PositiveSmallIntegerField(null=True, blank=True)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    file = models.FileField(upload_to=disclosure_upload_path, storage=private_storage)
    original_name = models.CharField(max_length=255, blank=True)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    uploaded_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='uploaded')
    verified_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    verified_at = models.DateTimeField(null=True, blank=True)
    review_note = models.TextField(blank=True)
    # Shown to the public only when verified AND this is true.
    is_public = models.BooleanField(default=True)

    class Meta:
        ordering = ['-uploaded_at', '-id']
        indexes = [models.Index(fields=['requirement', 'year', 'quarter']), models.Index(fields=['status'])]

    def __str__(self):
        return f'{self.title} ({self.year}{f" Q{self.quarter}" if self.quarter else ""}) - {self.status}'


# ─── SK Compliance Monitoring System: verification and publication layer ──────

def sk_record_upload_path(instance, filename):
    ext = os.path.splitext(filename or '')[1].lower()
    return f'sk_compliance/{instance.barangay_id}/{instance.category}/{uuid.uuid4().hex}{ext}'


class SKComplianceRecord(models.Model):
    """One submission of one SK compliance document, with its review and publication state.

    This is a MONITORING layer. The five categories use the same codes as sk_requirements.SKRequirement:
      cbydp, abyip, annual_budget      -> reference the EXISTING SKRequirement row (and the file stored there). Nothing is copied:
                                          `source_file_name` only remembers which stored file was submitted, so the file that was
                                          verified stays the file that is published even if the SK later uploads a newer one.
      quarterly_cash (RCB), monthly_pr (MIL) -> new documents with a reporting quarter or month, uploaded here (`file`).
    Records are never overwritten: every submission is a row, so the full history stays.
    """
    STATUS_CHOICES = [
        ('submitted', 'Submitted'),
        ('under_verification', 'Under Verification'),
        ('returned', 'Returned for Correction'),
        ('verified', 'Verified'),
        ('published', 'Published'),
    ]

    barangay = models.ForeignKey('sk_requirements.SKBarangay', on_delete=models.PROTECT, related_name='compliance_records')
    category = models.CharField(max_length=30)  # a code from sk_requirements REQUIREMENT_CHOICES
    year = models.PositiveSmallIntegerField()
    period_end_year = models.PositiveSmallIntegerField(null=True, blank=True)  # CBYDP is a three-year plan
    quarter = models.PositiveSmallIntegerField(null=True, blank=True)
    month = models.PositiveSmallIntegerField(null=True, blank=True)

    requirement = models.ForeignKey('sk_requirements.SKRequirement', null=True, blank=True, on_delete=models.SET_NULL, related_name='compliance_records')
    source_file_name = models.CharField(max_length=500, blank=True)
    file = models.FileField(upload_to=sk_record_upload_path, storage=private_storage, null=True, blank=True)
    original_name = models.CharField(max_length=255, blank=True)

    # MIL only: a formal declaration that there were no purchase requests for the month. Never inferred from a blank upload.
    is_none_declaration = models.BooleanField(default=False)

    title = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True)  # shown publicly once published
    total_amount = models.DecimalField(max_digits=16, decimal_places=2, null=True, blank=True)  # approved budget total, when known

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='submitted')
    submitted_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    submitted_at = models.DateTimeField(default=None, null=True, blank=True)
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_remarks = models.TextField(blank=True)  # internal: never sent to the public
    published_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-submitted_at', '-id']
        indexes = [
            models.Index(fields=['barangay', 'category', 'year']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f'{self.barangay} - {self.category} {self.year} ({self.status})'
