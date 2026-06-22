from django.conf import settings
from django.db import models
from django.utils.text import slugify


class School(models.Model):
    SCHOOL_TYPE_CHOICES = [
        ('public', 'Public'),
        ('private', 'Private'),
        ('state_university', 'State University'),
        ('community_college', 'Community College'),
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
    is_active = models.BooleanField(default=True)
    is_featured = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)


class Program(models.Model):
    PROGRAM_TYPE_CHOICES = [
        ('undergraduate', 'Undergraduate'),
        ('graduate', 'Graduate'),
        ('vocational', 'Vocational'),
        ('short_course', 'Short Course'),
    ]

    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, blank=True)
    description = models.TextField(blank=True)
    program_type = models.CharField(max_length=20, choices=PROGRAM_TYPE_CHOICES)
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
