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

    AUDIENCE_CHOICES = [
        ('general_youth', 'General Youth'),
        ('youth_org_leaders', 'Youth Organization Leaders'),
        ('sk_officials', 'SK Officials'),
    ]

    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)
    description = models.TextField()
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES)
    # Who the course is mainly designed for. This only labels the course: it never restricts enrollment.
    audience = models.CharField(max_length=20, choices=AUDIENCE_CHOICES, default='general_youth')
    learning_outcomes = models.JSONField(default=list, blank=True, help_text='Short topics the learner has mastered after the course, for example: budget planning. Used on the certificate.')
    passing_score = models.PositiveSmallIntegerField(
        default=75, validators=[MinValueValidator(1), MaxValueValidator(100)],
        help_text='Percent of correct answers needed to pass a lesson assessment')
    certificate_statement = models.TextField(
        blank=True, help_text='Optional wording for the certificate. Use {name} and {course}. Leave empty to build it from the learning outcomes.')
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
    video_file = models.FileField(upload_to='courses/videos/', blank=True)  # an uploaded video (alternative to a link)
    video_title = models.CharField(max_length=255, blank=True, help_text='The topic of the video the learner should watch')
    video_manual_confirm = models.BooleanField(
        default=False, help_text='Use for a link that cannot play inside the page: the learner watches it on the other site and confirms')
    study_resources = models.JSONField(
        default=list, blank=True, help_text='Reading or study links for this lesson: [{"title": "...", "url": "https://...", "source": "..."}]')
    video_required_percent = models.PositiveSmallIntegerField(
        default=80, validators=[MinValueValidator(1), MaxValueValidator(100)],
        help_text='Share of the video that must be played before the assessment opens')
    passing_score = models.PositiveSmallIntegerField(
        null=True, blank=True, validators=[MinValueValidator(1), MaxValueValidator(100)],
        help_text='Overrides the course passing score for this lesson only')
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
    # The name the learner typed at enrollment. It is printed on the certificate, never the account username.
    certificate_name = models.CharField(max_length=150, blank=True)

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
    video_watched_at = models.DateTimeField(null=True, blank=True)  # set once the required share of the video was played
    video_watched_seconds = models.FloatField(default=0)   # playback time the server has credited
    video_duration = models.FloatField(default=0)
    video_last_position = models.FloatField(default=0)
    video_last_ping = models.DateTimeField(null=True, blank=True)
    notes_read_at = models.DateTimeField(null=True, blank=True)  # for lessons without a video: the learner confirmed reading the notes

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
    # Snapshot at issuance, so the certificate never changes if the course or the account is edited later.
    recipient_name = models.CharField(max_length=150, blank=True)
    course_title = models.CharField(max_length=255, blank=True)
    audience = models.CharField(max_length=20, blank=True)
    statement = models.TextField(blank=True)
    outcomes = models.JSONField(default=list, blank=True)
    modules_summary = models.JSONField(default=list, blank=True)
    signatories = models.JSONField(default=list, blank=True)
    completed_on = models.DateField(null=True, blank=True)

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


class CertificateSetting(models.Model):
    """One row of certificate branding and signatories, managed by administrators."""
    organization_name = models.CharField(max_length=200, default='Lucena City Youth Development Office')
    platform_name = models.CharField(max_length=200, default='LYDOP | Lucena Youth Leadership Hub')
    signatory_1_name = models.CharField(max_length=150, blank=True)
    signatory_1_title = models.CharField(max_length=150, blank=True)
    signatory_2_name = models.CharField(max_length=150, blank=True)
    signatory_2_title = models.CharField(max_length=150, blank=True)
    footer_note = models.CharField(max_length=255, default='Issued through the LYDOP learning platform of the Lucena City Youth Development Office.')
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        self.pk = 1  # a single settings row
        super().save(*args, **kwargs)

    @classmethod
    def get(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def signatories(self):
        out = []
        for n, t in ((self.signatory_1_name, self.signatory_1_title), (self.signatory_2_name, self.signatory_2_title)):
            if n.strip():
                out.append({'name': n.strip(), 'title': t.strip()})
        return out
