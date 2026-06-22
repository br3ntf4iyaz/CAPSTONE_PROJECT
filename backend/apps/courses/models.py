from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils.text import slugify


class Course(models.Model):
    CATEGORY_CHOICES = [
        ('leadership', 'Leadership'),
        ('governance', 'Governance'),
        ('life_skills', 'Life Skills'),
        ('tech', 'Technology'),
        ('finance', 'Finance'),
        ('communication', 'Communication'),
    ]

    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)
    description = models.TextField()
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES)
    thumbnail = models.ImageField(upload_to='courses/thumbnails/', blank=True, null=True)
    instructor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='courses_taught',
    )
    price = models.DecimalField(max_digits=8, decimal_places=2, default=0, blank=True)
    is_published = models.BooleanField(default=False)
    is_featured = models.BooleanField(default=False)
    duration_hours = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)  # soft delete
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['slug']),
            models.Index(fields=['category']),
            models.Index(fields=['is_published', 'is_active']),
            models.Index(fields=['is_featured']),
        ]

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.title) or 'course'
            slug = base
            n = 1
            while Course.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f'{base}-{n}'
                n += 1
            self.slug = slug
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title


class CourseModule(models.Model):
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name='modules',
    )
    title = models.CharField(max_length=255)
    order = models.PositiveIntegerField(default=0)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order']
        indexes = [
            models.Index(fields=['course', 'order']),
        ]

    def __str__(self):
        return f'{self.course.title} — Module {self.order}: {self.title}'


class Lesson(models.Model):
    module = models.ForeignKey(
        CourseModule,
        on_delete=models.CASCADE,
        related_name='lessons',
    )
    title = models.CharField(max_length=255)
    order = models.PositiveIntegerField(default=0)
    content = models.TextField()
    video_url = models.URLField(blank=True)
    resource_file = models.FileField(upload_to='courses/resources/', blank=True)
    duration_minutes = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order']
        indexes = [
            models.Index(fields=['module', 'order']),
        ]

    def __str__(self):
        return f'{self.module.title} — Lesson {self.order}: {self.title}'


class Enrollment(models.Model):
    STATUS_CHOICES = [
        ('enrolled', 'Enrolled'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='enrollments',
    )
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name='enrollments',
    )
    enrolled_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    progress_percent = models.PositiveIntegerField(
        default=0,
        validators=[MaxValueValidator(100)],
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='enrolled')

    class Meta:
        ordering = ['-enrolled_at']
        unique_together = ('user', 'course')
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['course', 'status']),
        ]

    def __str__(self):
        return f'{self.user} enrolled in {self.course.title}'


class LessonProgress(models.Model):
    enrollment = models.ForeignKey(
        Enrollment,
        on_delete=models.CASCADE,
        related_name='lesson_progresses',
    )
    lesson = models.ForeignKey(
        Lesson,
        on_delete=models.CASCADE,
        related_name='progresses',
    )
    completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('enrollment', 'lesson')
        indexes = [
            models.Index(fields=['enrollment', 'completed']),
        ]

    def __str__(self):
        status = 'completed' if self.completed else 'incomplete'
        return f'{self.enrollment.user} — {self.lesson.title} ({status})'


class QuizAttempt(models.Model):
    enrollment = models.ForeignKey(
        Enrollment,
        on_delete=models.CASCADE,
        related_name='quiz_attempts',
    )
    lesson = models.ForeignKey(
        'Lesson',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='quiz_attempts',
    )
    score = models.PositiveIntegerField(default=0)
    max_score = models.PositiveIntegerField(default=0)
    passed = models.BooleanField(default=False)
    attempted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-attempted_at']
        indexes = [
            models.Index(fields=['enrollment', 'passed']),
        ]

    def __str__(self):
        return (
            f'{self.enrollment.user} — Quiz attempt '
            f'({self.score}/{self.max_score}) on {self.attempted_at.date()}'
        )


class Certificate(models.Model):
    enrollment = models.OneToOneField(
        Enrollment,
        on_delete=models.CASCADE,
        related_name='certificate',
    )
    issued_at = models.DateTimeField(auto_now_add=True)
    certificate_number = models.CharField(max_length=100, unique=True)
    file = models.FileField(upload_to='courses/certificates/', null=True, blank=True)

    class Meta:
        ordering = ['-issued_at']
        indexes = [
            models.Index(fields=['certificate_number']),
        ]

    def __str__(self):
        return f'Certificate {self.certificate_number} — {self.enrollment.course.title}'


class Question(models.Model):
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name='questions')
    text = models.TextField()
    order = models.PositiveIntegerField(default=0)
    explanation = models.TextField(blank=True, help_text='Shown after answering — explains why the correct answer is right.')

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f'Q{self.order}: {self.text[:60]}'


class QuestionChoice(models.Model):
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='choices')
    text = models.CharField(max_length=500)
    is_correct = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f'{"[CORRECT] " if self.is_correct else ""}{self.text[:60]}'


class QuizAttemptAnswer(models.Model):
    attempt = models.ForeignKey(QuizAttempt, on_delete=models.CASCADE, related_name='answers')
    question = models.ForeignKey(Question, on_delete=models.PROTECT)
    selected_choice = models.ForeignKey(QuestionChoice, on_delete=models.PROTECT)
    is_correct = models.BooleanField()

    class Meta:
        unique_together = ('attempt', 'question')
