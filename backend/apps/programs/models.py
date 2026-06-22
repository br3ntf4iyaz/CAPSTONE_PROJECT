from django.db import models
from django.conf import settings


CATEGORY_CHOICES = [
    ('social_inclusion', 'Social Inclusion and Equity'),
    ('health', 'Health'),
    ('active_citizenship', 'Active Citizenship'),
    ('peace_building', 'Peace Building and Security'),
    ('education', 'Education'),
    ('environment', 'Environment'),
    ('governance', 'Governance'),
    ('agriculture', 'Agriculture'),
    ('global_mobility', 'Global Mobility'),
    ('economic', 'Economic Environment'),
]

STATUS_CHOICES = [
    ('ongoing', 'Ongoing'),
    ('completed', 'Completed'),
    ('upcoming', 'Upcoming'),
    ('cancelled', 'Cancelled'),
]

SUBMITTER_TYPE = [
    ('sk', 'SK'),
    ('youth_org', 'Youth Organization'),
]


class YouthProgram(models.Model):
    title = models.CharField(max_length=300)
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES)
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='upcoming')
    submitter_type = models.CharField(max_length=15, choices=SUBMITTER_TYPE)
    organization = models.ForeignKey(
        'youth_orgs.YouthOrganization',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='programs',
    )
    barangay = models.CharField(max_length=100, blank=True)
    description = models.TextField()
    objectives = models.TextField(blank=True)
    target_beneficiaries = models.TextField(blank=True)
    male_participants = models.PositiveIntegerField(default=0)
    female_participants = models.PositiveIntegerField(default=0)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    location = models.CharField(max_length=200, blank=True)
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='programs_submitted',
    )
    is_featured = models.BooleanField(default=False)
    thumbnail = models.ImageField(upload_to='program_thumbnails/', null=True, blank=True)
    contact_person = models.CharField(max_length=150, blank=True, default='')
    contact_email = models.EmailField(blank=True, default='')
    contact_phone = models.CharField(max_length=30, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_featured', '-created_at']
        indexes = [
            models.Index(fields=['category']),
            models.Index(fields=['status']),
            models.Index(fields=['submitter_type']),
            models.Index(fields=['barangay']),
            models.Index(fields=['is_featured', 'status']),
            models.Index(fields=['start_date', 'end_date']),
        ]

    def __str__(self):
        return f'{self.title} ({self.get_status_display()})'

    @property
    def total_participants(self):
        return self.male_participants + self.female_participants


class ProgramSubmission(models.Model):
    """PDF file submissions for SK or Youth Org programs."""
    SUBMISSION_STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('pending', 'Pending Review'),
        ('revision_requested', 'Revision Requested'),
        ('approved', 'Approved'),
        ('in_progress', 'In Progress'),
        ('completion_submitted', 'Completion Submitted'),
        ('completed', 'Completed'),
        ('rejected', 'Rejected'),
    ]

    program = models.ForeignKey(
        YouthProgram,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='submissions',
    )
    submitter_type = models.CharField(max_length=15, choices=SUBMITTER_TYPE)
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='program_submissions',
    )
    organization = models.ForeignKey(
        'youth_orgs.YouthOrganization',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='program_submissions',
    )
    title = models.CharField(max_length=300)
    description = models.TextField(blank=True)
    file = models.FileField(upload_to='program_submissions/', null=True, blank=True)
    submitted_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    status = models.CharField(
        max_length=25,
        choices=SUBMISSION_STATUS_CHOICES,
        default='draft',
    )
    admin_notes = models.TextField(blank=True)

    # Extended fields
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES, blank=True)
    objectives = models.TextField(blank=True)
    target_beneficiaries = models.TextField(blank=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    location = models.CharField(max_length=200, blank=True)
    barangay = models.CharField(max_length=100, blank=True)
    expected_participants = models.PositiveIntegerField(null=True, blank=True)
    male_participants = models.PositiveIntegerField(null=True, blank=True)
    female_participants = models.PositiveIntegerField(null=True, blank=True)
    lgbtq_participants = models.PositiveIntegerField(null=True, blank=True, default=0)
    prefer_not_say_participants = models.PositiveIntegerField(null=True, blank=True, default=0)
    estimated_budget = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    # Submission type
    submission_type = models.CharField(
        max_length=10,
        choices=[('policy', 'Policy'), ('ppa', 'PPA')],
        default='ppa',
    )

    # Policy-specific fields
    policy_type = models.CharField(max_length=150, blank=True, default='')
    policy_date_passed = models.DateField(null=True, blank=True)

    # PPA-specific fields
    abyip_reference_code = models.CharField(max_length=100, blank=True, default='')
    expected_result = models.TextField(blank=True, default='')
    performance_indicator = models.TextField(blank=True, default='')
    period_of_implementation = models.CharField(max_length=200, blank=True, default='')
    actual_disbursement = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)

    thumbnail = models.ImageField(upload_to='submission_thumbnails/', null=True, blank=True)
    revision_notes = models.TextField(blank=True)

    # Completion fields
    actual_participants = models.PositiveIntegerField(null=True, blank=True)
    outcomes_narrative = models.TextField(blank=True)
    completion_report_file = models.FileField(upload_to='completion_reports/', null=True, blank=True)

    # Review timestamps
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='reviewed_submissions',
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-submitted_at']
        indexes = [
            models.Index(fields=['submitter_type']),
            models.Index(fields=['status']),
            models.Index(fields=['submitted_by']),
            models.Index(fields=['organization']),
            models.Index(fields=['category']),
            models.Index(fields=['start_date']),
        ]

    def __str__(self):
        return f'{self.title} — {self.submitted_by} ({self.get_status_display()})'


class SubmissionAttachment(models.Model):
    KIND_CHOICES = [
        ('main_proposal', 'Main Proposal'),
        ('supporting', 'Supporting Document'),
        ('progress_photo', 'Progress Photo'),
        ('completion_photo', 'Completion Photo'),
    ]
    submission = models.ForeignKey(ProgramSubmission, on_delete=models.CASCADE, related_name='attachments')
    kind = models.CharField(max_length=20, choices=KIND_CHOICES, default='supporting')
    file = models.FileField(upload_to='submission_attachments/')
    label = models.CharField(max_length=200, blank=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['kind', 'uploaded_at']


class FeaturedSlide(models.Model):
    """Activity / program photos shown in the home-page slider."""

    TAG_CHOICES = [
        ('lydo_program',    'LYDO Program'),
        ('sk_activity',     'SK Activity'),
        ('community_event', 'Community Event'),
        ('lydo_assembly',   'LYDO Assembly'),
        ('other',           'Other'),
    ]

    # Tailwind classes stored here so the frontend never hard-codes them
    TAG_COLOR_MAP = {
        'lydo_program':    'bg-accent-400 text-white',
        'sk_activity':     'bg-emerald-500 text-white',
        'community_event': 'bg-amber-500 text-white',
        'lydo_assembly':   'bg-primary text-white',
        'other':           'bg-gray-500 text-white',
    }

    title       = models.CharField(max_length=300)
    description = models.TextField()
    organizer   = models.CharField(max_length=200)
    tag_type    = models.CharField(max_length=20, choices=TAG_CHOICES, default='lydo_program')
    image       = models.ImageField(upload_to='featured_slides/', null=True, blank=True)
    order       = models.PositiveIntegerField(default=0, db_index=True)
    is_active   = models.BooleanField(default=True, db_index=True)
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['order', '-created_at']

    def __str__(self):
        return self.title

    @property
    def tag_label(self):
        return dict(self.TAG_CHOICES).get(self.tag_type, self.tag_type)

    @property
    def tag_color(self):
        return self.TAG_COLOR_MAP.get(self.tag_type, 'bg-gray-500 text-white')


class SubmissionReviewLog(models.Model):
    ACTION_CHOICES = [
        ('submitted', 'Submitted'),
        ('revision_requested', 'Revision Requested'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('in_progress_marked', 'Marked In Progress'),
        ('completion_submitted', 'Completion Submitted'),
        ('completed', 'Completed'),
    ]
    submission = models.ForeignKey(ProgramSubmission, on_delete=models.CASCADE, related_name='review_logs')
    action = models.CharField(max_length=30, choices=ACTION_CHOICES)
    notes = models.TextField(blank=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
