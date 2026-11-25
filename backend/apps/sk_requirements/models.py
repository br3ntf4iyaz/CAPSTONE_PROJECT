from django.db import models
from django.conf import settings

from apps.accounts.storage import private_storage


class SKRequirementTemplate(models.Model):
    """Defines the standard requirements all SK councils must submit."""
    name = models.CharField(max_length=200, unique=True)
    description = models.TextField(blank=True)
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ['order', 'name']

    def __str__(self):
        return self.name


REQUIREMENT_CHOICES = [
    ('cbydp', 'Comprehensive Barangay Youth Development Plan (CBYDP)'),
    ('abyip', 'Annual Barangay Youth Investment Program'),
    ('annual_budget', 'Annual Budget Plan'),
    ('quarterly_cash', 'Quarterly Cash-in-Bank and Other Financial Transactions'),
    ('monthly_pr', 'Monthly Itemized List of Purchase Requests'),
    ('annex_h', 'Annex H'),
    ('policies', 'Policies (Resolutions and Ordinances)'),
    ('minutes', 'Minutes of the Meeting'),
    ('kk_assembly', 'Conduct of KK Assembly'),
    ('linggo_kabataan', 'Conduct of Linggo ng Kabataan'),
]

STATUS_CHOICES = [
    ('submitted', 'Submitted'),
    ('pending', 'Pending'),
    ('overdue', 'Overdue'),
    ('draft', 'Draft'),
]


class SKBarangay(models.Model):
    """Represents each barangay's SK council."""
    barangay_name = models.CharField(max_length=100, unique=True)
    sk_chairperson = models.CharField(max_length=200, blank=True)
    contact_email = models.EmailField(blank=True)
    contact_phone = models.CharField(max_length=20, blank=True)
    description = models.TextField(blank=True)
    logo = models.ImageField(upload_to='sk_logos/', null=True, blank=True)
    chairperson_photo = models.ImageField(upload_to='sk_chairpersons/', null=True, blank=True)
    group_photo = models.ImageField(upload_to='sk_groups/', null=True, blank=True)  # the council group picture
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['barangay_name']
        verbose_name = 'SK Barangay'
        verbose_name_plural = 'SK Barangays'
        indexes = [
            models.Index(fields=['is_active']),
        ]

    def __str__(self):
        return self.barangay_name


class SKMember(models.Model):
    """A member of a barangay SK council (7 kagawad, secretary, treasurer)."""
    POSITION_CHOICES = [
        ('kagawad', 'SK Kagawad'),
        ('secretary', 'SK Secretary'),
        ('treasurer', 'SK Treasurer'),
    ]
    barangay = models.ForeignKey(SKBarangay, on_delete=models.CASCADE, related_name='members')
    position = models.CharField(max_length=20, choices=POSITION_CHOICES)
    name = models.CharField(max_length=200)
    photo = models.ImageField(upload_to='sk_members/', null=True, blank=True)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['barangay', 'order', 'id']

    def __str__(self):
        return f'{self.get_position_display()} {self.name} ({self.barangay})'


class SKRequirement(models.Model):
    barangay = models.ForeignKey(
        SKBarangay,
        on_delete=models.CASCADE,
        related_name='requirements',
    )
    requirement_type = models.CharField(max_length=30, choices=REQUIREMENT_CHOICES)
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='pending')
    # Private storage: a document is public only once LYDO has verified and published it (see the FPDPB in the compliance app).
    file = models.FileField(upload_to='sk_requirements/', storage=private_storage, null=True, blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    period_year = models.PositiveSmallIntegerField(null=True, blank=True)  # the reporting year the SK says the document is for
    period_label = models.CharField(max_length=120, blank=True)  # the applicable period, in the SK's words (for example "Q1 meeting, March 2026")
    sk_remarks = models.TextField(blank=True)  # what the SK wrote when submitting
    review_remarks = models.TextField(blank=True)  # what LYDO wrote when approving or returning it
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sk_requirements_reviewed',
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['barangay', 'requirement_type']
        unique_together = ('barangay', 'requirement_type')
        indexes = [
            models.Index(fields=['barangay', 'status']),
            models.Index(fields=['requirement_type']),
            models.Index(fields=['status']),
            models.Index(fields=['due_date']),
        ]

    def __str__(self):
        return f'{self.barangay.barangay_name} — {self.get_requirement_type_display()} ({self.get_status_display()})'


class SKFeedback(models.Model):
    CATEGORY_CHOICES = [
        ('concern', 'Concern'),
        ('suggestion', 'Suggestion'),
        ('praise', 'Praise'),
    ]
    FEEDBACK_STATUS_CHOICES = [
        ('received', 'Received'),
        ('acknowledged', 'Acknowledged'),
        ('resolved', 'Resolved'),
    ]

    barangay = models.ForeignKey(
        SKBarangay, on_delete=models.CASCADE, related_name='feedback'
    )
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True
    )
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='concern')
    subject = models.CharField(max_length=200)
    message = models.TextField(max_length=2000)
    rating = models.PositiveSmallIntegerField(null=True, blank=True)
    image = models.ImageField(upload_to='sk_feedback/', null=True, blank=True)
    is_anonymous = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=FEEDBACK_STATUS_CHOICES, default='received')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.barangay.barangay_name} — {self.category} by {self.submitted_by}'


class SKOfficialSocial(models.Model):
    """What ONE SK official chose to make public: Facebook links, public contact and a short introduction.

    It belongs to one seat: a member (OneToOne) or the barangay Chairperson. When the person in a seat is replaced, the
    record is deleted (see signals.py), so the new official never inherits the previous official's links.
    """
    barangay = models.ForeignKey(SKBarangay, on_delete=models.CASCADE, related_name='socials')
    member = models.OneToOneField(SKMember, null=True, blank=True, on_delete=models.CASCADE, related_name='social')
    is_chairperson = models.BooleanField(default=False)
    official_name = models.CharField(max_length=200, blank=True)  # who the record was written for
    facebook_profile_url = models.URLField(max_length=300, blank=True)
    facebook_page_url = models.URLField(max_length=300, blank=True)
    messenger_url = models.URLField(max_length=300, blank=True)
    public_email = models.EmailField(blank=True)
    public_contact_number = models.CharField(max_length=30, blank=True)
    public_bio = models.TextField(max_length=500, blank=True)
    # nothing is shown to the public until a manager turns this on
    social_links_visibility = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')

    class Meta:
        constraints = [models.UniqueConstraint(fields=['barangay'], condition=models.Q(is_chairperson=True), name='one_chairperson_social_per_barangay')]

    def __str__(self):
        return f'{self.official_name} ({self.barangay.barangay_name})'


class SKPublicActivity(models.Model):
    """A public activity or announcement of an SK official, with a link to a PUBLIC Facebook post typed in by hand.
    The system does not read Facebook: nothing here is fetched automatically."""
    social = models.ForeignKey(SKOfficialSocial, on_delete=models.CASCADE, related_name='activities')
    title = models.CharField(max_length=160)
    description = models.TextField(max_length=500, blank=True)
    facebook_post_url = models.URLField(max_length=300)
    activity_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-activity_date', '-created_at']


class SKRequirementConfig(models.Model):
    """The central definition of one of the ten SK requirements: what it is, what to submit, and who owes it.
    Shared by every barangay. A barangay's own progress lives in its SKRequirement row and its compliance records."""
    code = models.CharField(max_length=30, unique=True, choices=REQUIREMENT_CHOICES)
    description = models.TextField(blank=True)
    instructions = models.TextField(blank=True)  # shown on the submission form; LYDO can edit it
    is_active = models.BooleanField(default=True)
    order = models.PositiveSmallIntegerField(default=0)
    applies_to_all = models.BooleanField(default=True)
    barangays = models.ManyToManyField(SKBarangay, blank=True, related_name='configured_requirements')  # used when applies_to_all is off

    class Meta:
        ordering = ['order', 'id']

    def __str__(self):
        return self.get_code_display()


class SKDeadline(models.Model):
    """An OFFICIAL deadline set by LYDO. A requirement is overdue only when such a deadline exists and has passed. None is ever assumed."""
    code = models.CharField(max_length=30, choices=REQUIREMENT_CHOICES)
    year = models.PositiveSmallIntegerField()
    quarter = models.PositiveSmallIntegerField(null=True, blank=True)  # RCB
    month = models.PositiveSmallIntegerField(null=True, blank=True)  # MIL
    deadline = models.DateField()
    is_active = models.BooleanField(default=True)
    applies_to_all = models.BooleanField(default=True)
    barangays = models.ManyToManyField(SKBarangay, blank=True, related_name='deadlines')
    note = models.CharField(max_length=200, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['year', 'code', 'quarter', 'month', 'deadline']
        indexes = [models.Index(fields=['code', 'year'])]

    def __str__(self):
        return f'{self.get_code_display()} {self.year}: {self.deadline}'
