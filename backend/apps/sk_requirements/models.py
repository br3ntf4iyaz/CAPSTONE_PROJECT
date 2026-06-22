from django.db import models
from django.conf import settings


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
]


class SKBarangay(models.Model):
    """Represents each barangay's SK council."""
    barangay_name = models.CharField(max_length=100, unique=True)
    sk_chairperson = models.CharField(max_length=200, blank=True)
    contact_email = models.EmailField(blank=True)
    contact_phone = models.CharField(max_length=20, blank=True)
    description = models.TextField(blank=True)
    logo = models.ImageField(upload_to='sk_logos/', null=True, blank=True)
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


class SKRequirement(models.Model):
    barangay = models.ForeignKey(
        SKBarangay,
        on_delete=models.CASCADE,
        related_name='requirements',
    )
    requirement_type = models.CharField(max_length=30, choices=REQUIREMENT_CHOICES)
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='pending')
    file = models.FileField(upload_to='sk_requirements/', null=True, blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
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
