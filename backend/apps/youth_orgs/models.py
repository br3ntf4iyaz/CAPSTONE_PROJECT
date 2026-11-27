from django.db import models
from django.conf import settings


class YouthOrganization(models.Model):
    CLASS_CHOICES = [
        ('school_based', 'School-Based'),
        ('community_based', 'Community-Based'),
        ('faith_based', 'Faith-Based'),
    ]
    SUBCLASS_CHOICES = [
        ('sk_council', 'SK Council'),
        ('youth_org', 'Youth Organization (15-30)'),
        ('youth_serving', 'Youth Serving Organization (Mixed Ages)'),
    ]
    REG_CHOICES = [
        ('lydo', 'Lydo Registered'),
        ('nyc', 'NYC Registered'),
        ('not_registered', 'Not Yet Registered'),
    ]
    STATUS_CHOICES = [
        ('pending', 'Pending Review'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]

    name = models.CharField(max_length=200, unique=True)
    classification = models.CharField(max_length=30, choices=CLASS_CHOICES)
    sub_classification = models.CharField(max_length=30, choices=SUBCLASS_CHOICES)
    registration_category = models.CharField(
        max_length=20, choices=REG_CHOICES, default='not_registered'
    )
    barangay = models.CharField(max_length=100, blank=True)
    description = models.TextField(blank=True)
    contact_person = models.CharField(max_length=200, blank=True)
    contact_email = models.EmailField(blank=True)
    contact_phone = models.CharField(max_length=20, blank=True)
    logo = models.ImageField(upload_to='org_logos/', null=True, blank=True)
    # What the organization shows the public (all optional). Nothing here is private.
    mission = models.TextField(blank=True)
    membership_requirements = models.TextField(blank=True)
    how_to_join = models.TextField(blank=True)
    facebook_url = models.URLField(max_length=300, blank=True)
    accepting_members = models.BooleanField(default=True)  # shown as the recruitment status
    # How this organization takes members: through LYDOP (its own officers review the applications), through its own link
    # (Google Form, Facebook), or only by contacting it directly. LYDO never approves members for an organization.
    MODE_CHOICES = [('in_app', 'Apply here in LYDOP'), ('external', 'Apply through the organization\'s own link'), ('contact', 'Contact the organization')]
    application_mode = models.CharField(max_length=10, choices=MODE_CHOICES, default='in_app')
    external_apply_url = models.URLField(max_length=300, blank=True)
    acronym = models.CharField(max_length=30, blank=True)
    registration_number = models.CharField(max_length=60, blank=True)  # the YORP registration number LYDO or NYC gave
    # where the information about an organization listed by LYDO or by us comes from (a public web page), shown on its profile
    source_url = models.URLField(max_length=400, blank=True)
    # the colour of its card and profile in the directory (empty: follows the kind of organization)
    ACCENT_CHOICES = [('blue', 'Blue'), ('emerald', 'Green'), ('rose', 'Red'), ('amber', 'Yellow'), ('violet', 'Purple'), ('orange', 'Orange'), ('teal', 'Teal'), ('sky', 'Sky blue')]
    accent = models.CharField(max_length=10, choices=ACCENT_CHOICES, blank=True)
    registration_valid_until = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    is_compliant = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='submitted_orgs',
    )
    admin_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        indexes = [
            models.Index(fields=['classification']),
            models.Index(fields=['sub_classification']),
            models.Index(fields=['registration_category']),
            models.Index(fields=['barangay']),
            models.Index(fields=['is_active', 'is_compliant']),
        ]

    def __str__(self):
        return self.name


class OrgOfficer(models.Model):
    """One officer on the executive board of an organization. Who may see it depends on the position (see officers.py)."""
    organization = models.ForeignKey(YouthOrganization, on_delete=models.CASCADE, related_name='officers')
    position = models.CharField(max_length=20)
    custom_title = models.CharField(max_length=60, blank=True)  # only for the position "Other"
    name = models.CharField(max_length=200)
    # the account of this officer, when it is the leader who registered the organization
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f'{self.name} ({self.position}) of {self.organization_id}'


class OrgAccomplishment(models.Model):
    organization = models.ForeignKey(
        YouthOrganization,
        on_delete=models.CASCADE,
        related_name='accomplishments',
    )
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    date_achieved = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date_achieved', '-created_at']
        indexes = [
            models.Index(fields=['organization', 'date_achieved']),
        ]

    def __str__(self):
        return f'{self.organization.name} — {self.title}'


class OrgRequirement(models.Model):
    organization = models.ForeignKey(
        YouthOrganization,
        on_delete=models.CASCADE,
        related_name='requirements',
    )
    name = models.CharField(max_length=200)
    is_submitted = models.BooleanField(default=False)
    file = models.FileField(upload_to='org_requirements/', null=True, blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['name']
        indexes = [
            models.Index(fields=['organization', 'is_submitted']),
        ]

    def __str__(self):
        status = 'Submitted' if self.is_submitted else 'Pending'
        return f'{self.organization.name} — {self.name} ({status})'


# Documents every organization must submit for YORP registration.
DEFAULT_REQUIREMENTS = [
    'Constitution & By-Laws',
    'List of Officers',
    'Member Roster (at least 10 members)',
    'Recent Activity Report',
]


def ensure_default_requirements(org):
    """Give an organization its standard requirement checklist (idempotent)."""
    have = set(org.requirements.values_list('name', flat=True))
    missing = [n for n in DEFAULT_REQUIREMENTS if n not in have]
    if missing:
        OrgRequirement.objects.bulk_create(
            [OrgRequirement(organization=org, name=n) for n in missing]
        )


class OrgMembershipApplication(models.Model):
    """A signed-in young person asking to join a PUBLIC organization. The organization's submitter or LYDO decides."""
    STATUS_CHOICES = [
        ('pending', 'Pending verification'), ('reviewing', 'Under review'), ('revision', 'Revision required'),
        ('accepted', 'Approved'), ('declined', 'Rejected'), ('revoked', 'Revoked'),
    ]

    organization = models.ForeignKey(YouthOrganization, on_delete=models.CASCADE, related_name='membership_applications')
    applicant = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='org_applications')
    message = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    decision_note = models.TextField(blank=True)  # the applicant reads this
    decided_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    decided_at = models.DateTimeField(null=True, blank=True)
    privacy_consent_at = models.DateTimeField(null=True, blank=True)
    # the applicant's details as they were when the application was sent (never documents or ID photos)
    snapshot = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [models.UniqueConstraint(fields=['organization', 'applicant'], name='one_application_per_org_and_person')]

    def __str__(self):
        return f'{self.applicant} -> {self.organization.name} ({self.status})'

    @property
    def reference_number(self):
        return f'LYD-M-{self.pk:06d}'


class OrgMembershipEvent(models.Model):
    """Every step of a membership application, kept for good (applied, revision asked, resubmitted, approved, revoked ...)."""
    application = models.ForeignKey(OrgMembershipApplication, on_delete=models.CASCADE, related_name='events')
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    action = models.CharField(max_length=20)
    from_status = models.CharField(max_length=10, blank=True)
    to_status = models.CharField(max_length=10, blank=True)
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at', 'id']
