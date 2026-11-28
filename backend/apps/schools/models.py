from django.conf import settings
from django.db import models
from django.utils.text import slugify


class School(models.Model):
    SCHOOL_TYPE_CHOICES = [
        ('public', 'Public'),
        ('private', 'Private'),
        ('state_university', 'State University'),
        ('technical_vocational', 'Technical-Vocational'),
    ]

    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True, blank=True)
    school_type = models.CharField(max_length=30, choices=SCHOOL_TYPE_CHOICES)
    description = models.TextField(blank=True)
    address = models.CharField(max_length=500)
    municipality = models.CharField(max_length=100)
    province = models.CharField(max_length=100)
    region = models.CharField(max_length=100)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    phone = models.CharField(max_length=50, blank=True)
    email = models.EmailField(blank=True)
    website = models.URLField(blank=True)
    facebook_url = models.URLField(blank=True)
    logo = models.ImageField(upload_to='schools/logos/', null=True, blank=True)
    source_url = models.URLField(max_length=500, blank=True, help_text='Official page used to describe/verify this school.')
    verification_note = models.TextField(
        blank=True,
        help_text='Internal note: what still needs to be verified (shown to admins only).',
    )
    is_active = models.BooleanField(default=True)
    is_featured = models.BooleanField(default=False)
    # which levels the school teaches: the scholarship form shows each school under the level of the applicant
    offers_college = models.BooleanField(default=True)
    offers_senior_high = models.BooleanField(default=False)
    # Senior High School finder
    barangay = models.CharField(max_length=100, blank=True)
    in_techvoc = models.BooleanField(default=False, help_text='Listed under Tech-Voc / TESDA (SHS TVL track or TESDA programs). The specific tracks and qualifications are listed apart.')
    shs_note = models.TextField(blank=True, help_text='Shown to the public on the Senior High list, e.g. a clarification about where the Senior High School is.')
    INFO_STATUS_CHOICES = [
        ('verified', 'Verified'),
        ('pending', 'Pending verification'),
        ('needs_update', 'Needs update'),
    ]
    info_status = models.CharField(max_length=15, choices=INFO_STATUS_CHOICES, default='pending')
    last_verified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name

    @property
    def sector(self):
        """public / private / suc. A technical-vocational school is a private school."""
        return {'state_university': 'suc', 'public': 'public'}.get(self.school_type, 'private')

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)


class SchoolOffering(models.Model):
    """What a school offers at Senior High level: an academic strand, or a TESDA qualification. The two are kept apart."""
    KIND_CHOICES = [('strand', 'SHS strand / pathway'), ('tesda', 'TESDA qualification')]
    STATUS_CHOICES = [('verified', 'Verified'), ('pending', 'Pending verification')]

    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='offerings')
    kind = models.CharField(max_length=10, choices=KIND_CHOICES)
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=30, blank=True, help_text='e.g. STEM, HUMSS, or NC II')
    note = models.CharField(max_length=255, blank=True, help_text='e.g. the campus where it is offered')
    verification_status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    source_url = models.URLField(max_length=500, blank=True)
    source_note = models.CharField(max_length=255, blank=True, help_text='Where this was read, when there is no web page.')
    verified_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['kind', 'name']
        unique_together = ('school', 'kind', 'name')

    def __str__(self):
        return f"{self.school} - {self.name}"


class Program(models.Model):
    PROGRAM_TYPE_CHOICES = [
        ('bachelor', "Bachelor's Degree"),
        ('associate', 'Associate'),
        ('diploma', 'Diploma'),
        ('certificate', 'Certificate'),
        ('tesda', 'TESDA Qualification'),
        ('graduate', 'Graduate (Master)'),
        ('doctorate', 'Doctorate'),
        ('law', 'Law'),
        # legacy values kept so existing rows stay valid
        ('undergraduate', 'Undergraduate'),
        ('vocational', 'Vocational'),
        ('short_course', 'Short Course'),
    ]

    FIELD_CHOICES = [
        ('it_computing', 'Information Technology and Computer Studies'),
        ('business', 'Business and Management'),
        ('education', 'Education'),
        ('engineering', 'Engineering and Technology'),
        ('hospitality', 'Hospitality and Tourism'),
        ('maritime', 'Maritime Studies'),
        ('health', 'Health Sciences'),
        ('criminal_justice', 'Criminal Justice'),
        ('arts_sciences', 'Arts and Sciences'),
        ('techvoc', 'Technical-Vocational Studies'),
        ('law', 'Law'),
        ('other', 'Other'),
    ]

    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, blank=True)
    description = models.TextField(blank=True)
    program_type = models.CharField(max_length=20, choices=PROGRAM_TYPE_CHOICES)
    field_of_study = models.CharField(max_length=30, choices=FIELD_CHOICES, default='other')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.code})" if self.code else self.name


class SchoolProgram(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='school_programs')
    program = models.ForeignKey(Program, on_delete=models.CASCADE, related_name='school_programs')
    is_active = models.BooleanField(default=True)
    tuition_per_year = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    scholarship_available = models.BooleanField(default=False)
    admission_requirements = models.TextField(blank=True)
    VERIFICATION_CHOICES = [
        ('verified', 'Verified'),
        ('pending', 'Pending verification'),
    ]
    verification_status = models.CharField(max_length=10, choices=VERIFICATION_CHOICES, default='pending')
    source_url = models.URLField(max_length=500, blank=True, help_text='Official page confirming this program is offered.')
    verified_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['school', 'program']
        unique_together = ('school', 'program')

    def __str__(self):
        return f"{self.school} - {self.program}"


class SchoolBookmark(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='school_bookmarks',
    )
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='bookmarks')
    bookmarked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-bookmarked_at']
        unique_together = ('user', 'school')

    def __str__(self):
        return f"{self.user} bookmarked {self.school}"


class SchoolComparison(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='school_comparisons',
    )
    schools = models.ManyToManyField(School, related_name='comparisons', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return f"Comparison by {self.user} ({self.created_at.date()})"
