import os
import uuid
from django.conf import settings
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", User.Role.SUPER_ADMIN)
        return self.create_user(email, password, **extra_fields)


def avatar_upload_path(instance, filename):
    ext = os.path.splitext(filename)[1]
    return f"avatars/{instance.id}{ext}"


class User(AbstractBaseUser, PermissionsMixin):
    class Role(models.TextChoices):
        YOUTH = "youth", "Youth"
        LGU_ADMIN = "lgu_admin", "LGU Admin"
        SUPER_ADMIN = "super_admin", "Super Admin"

    class YouthType(models.TextChoices):
        GENERAL = "general_youth", "General Youth"
        SK = "sk", "SK (Sangguniang Kabataan)"
        YOUTH_ORG = "youth_org_leader", "Youth Organization Leader"

    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.YOUTH)
    # For role=youth, specifies the sub-type
    youth_type = models.CharField(
        max_length=20, choices=YouthType.choices,
        default=YouthType.GENERAL, blank=True,
    )
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_email_verified = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)
    avatar = models.ImageField(upload_to=avatar_upload_path, null=True, blank=True)
    onboarding_complete = models.BooleanField(default=True)  # skip forced onboarding

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["first_name", "last_name"]

    class Meta:
        ordering = ["-date_joined"]

    def __str__(self):
        return f"{self.full_name} ({self.email})"

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip()

    # Django's standard convention. Several serializers across the codebase
    # use `source='user.get_full_name'` or call `user.get_full_name()`
    # directly (assuming Django's default User.get_full_name method). This
    # custom User model only has the `full_name` property, so missing this
    # method caused 500s on every list endpoint that serialised the related
    # user (recognition, resources, events, projects, volunteers, …).
    # Adding it once at the source fixes all 18 callsites.
    def get_full_name(self):
        return self.full_name

    def get_short_name(self):
        return self.first_name or self.email


class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    bio = models.TextField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    barangay = models.CharField(max_length=100, blank=True)
    municipality = models.CharField(max_length=100, blank=True)
    province = models.CharField(max_length=100, blank=True)
    birthdate = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=20, blank=True)
    # SK-specific fields
    sk_position = models.CharField(max_length=100, blank=True)
    term_start = models.DateField(null=True, blank=True)
    term_end = models.DateField(null=True, blank=True)
    # Mentor-specific fields
    organization = models.CharField(max_length=200, blank=True)
    job_title = models.CharField(max_length=200, blank=True)
    years_of_experience = models.PositiveIntegerField(null=True, blank=True)
    facebook_url = models.URLField(blank=True)
    website_url = models.URLField(blank=True)
    # LGU Admin
    lgu_name = models.CharField(max_length=200, blank=True)
    lgu_position = models.CharField(max_length=200, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Profile of {self.user.full_name}"

    _COMPLETENESS_CHECKS = [
        ('bio', 'bio'),
        ('phone', 'phone number'),
        ('barangay', 'barangay'),
        ('municipality', 'municipality'),
        ('province', 'province'),
        ('birthdate', 'birthdate'),
        ('gender', 'gender'),
    ]

    @property
    def completeness_percent(self):
        filled = sum(1 for field, _ in self._COMPLETENESS_CHECKS if getattr(self, field))
        return int((filled / len(self._COMPLETENESS_CHECKS)) * 100)

    @property
    def missing_fields(self):
        return [label for field, label in self._COMPLETENESS_CHECKS if not getattr(self, field)]


class Skill(models.Model):
    name = models.CharField(max_length=100, unique=True)

    def __str__(self):
        return self.name


class Interest(models.Model):
    name = models.CharField(max_length=100, unique=True)

    def __str__(self):
        return self.name


class UserSkill(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="user_skills")
    skill = models.ForeignKey(Skill, on_delete=models.CASCADE)

    class Meta:
        unique_together = ("user", "skill")


class UserInterest(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="user_interests")
    interest = models.ForeignKey(Interest, on_delete=models.CASCADE)

    class Meta:
        unique_together = ("user", "interest")


class Document(models.Model):
    class DocType(models.TextChoices):
        RESUME = "resume", "Resume"
        CERTIFICATE = "certificate", "Certificate"
        ID = "id", "Government ID"
        OTHER = "other", "Other"

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="documents")
    doc_type = models.CharField(max_length=20, choices=DocType.choices)
    title = models.CharField(max_length=200)
    file = models.FileField(upload_to="documents/")
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} ({self.user.full_name})"


class EmailVerificationToken(models.Model):
    """One-time token used to verify a new user's email address."""
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='email_verification_token',
    )
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def is_expired(self):
        """Verification links are valid for 24 hours (as stated in the email)."""
        from datetime import timedelta
        from django.utils import timezone
        return timezone.now() > self.created_at + timedelta(hours=24)


class PasswordResetToken(models.Model):
    """One-time token used for password reset. Valid for 1 hour."""
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='password_reset_token',
    )
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def is_expired(self):
        from datetime import timedelta
        return timezone.now() > self.created_at + timedelta(hours=1)

    def __str__(self):
        return f"PasswordResetToken for {self.user.email}"


class AuditLog(models.Model):
    user = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name="audit_logs"
    )
    action = models.CharField(max_length=200)
    model_name = models.CharField(max_length=100, blank=True)
    object_id = models.PositiveIntegerField(null=True, blank=True)
    details = models.JSONField(default=dict)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user} - {self.action} at {self.created_at}"


class PersonalEvent(models.Model):
    COLOR_CHOICES = [
        ('blue',   'Blue'),
        ('green',  'Green'),
        ('red',    'Red'),
        ('yellow', 'Yellow'),
        ('purple', 'Purple'),
        ('pink',   'Pink'),
    ]

    user        = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='personal_events')
    title       = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    date        = models.DateField()
    time        = models.TimeField(null=True, blank=True)
    color       = models.CharField(max_length=20, choices=COLOR_CHOICES, default='blue')
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['date', 'time']

    def __str__(self):
        return f'{self.user.email} — {self.title} on {self.date}'
