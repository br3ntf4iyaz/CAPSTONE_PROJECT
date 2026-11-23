"""Learning progress rules. Everything that decides "may this person open this lesson?" lives here so the views,
the certificate and the review all use the same logic. Nothing in this module trusts the browser."""
import re
import secrets
from datetime import timedelta

from django.db import IntegrityError, transaction
from django.utils import timezone

from .models import Certificate, CertificateSetting, Enrollment, Lesson, LessonProgress, QuizAttempt

CERT_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
YOUTUBE_RE = re.compile(r'(?:youtube\.com/(?:watch\?(?:.*&)?v=|embed/|shorts/)|youtu\.be/)([A-Za-z0-9_-]{6,})')
DIRECT_VIDEO_EXTS = ('.mp4', '.webm', '.ogg', '.mov')


# ── ordering and locking ─────────────────────────────────────────────────────

def ordered_lessons(course):
    """Every lesson of the course in learning order (module order, then lesson order)."""
    return list(
        Lesson.objects.filter(module__course=course)
        .select_related('module')
        .order_by('module__order', 'module_id', 'order', 'id')
    )


def completed_lesson_ids(enrollment):
    return set(
        LessonProgress.objects.filter(enrollment=enrollment, completed=True).values_list('lesson_id', flat=True)
    )


def lesson_states(enrollment):
    """[(lesson, status)] where status is completed, current (the next one to do) or locked."""
    done = completed_lesson_ids(enrollment)
    out, current_assigned = [], False
    for lesson in ordered_lessons(enrollment.course):
        if lesson.id in done:
            out.append((lesson, 'completed'))
        elif not current_assigned:
            out.append((lesson, 'current'))
            current_assigned = True
        else:
            out.append((lesson, 'locked'))
    return out


def is_unlocked(enrollment, lesson):
    """A lesson can be opened when it is done already or when every lesson before it is done."""
    for l, status in lesson_states(enrollment):
        if l.id == lesson.id:
            return status != 'locked'
    return False


# ── video and reading requirement ────────────────────────────────────────────

def video_kind(lesson):
    """none | file | youtube | direct | other. Only the first four can be measured on the server's side."""
    if lesson.video_file:
        return 'file'
    url = (lesson.video_url or '').strip()
    if not url:
        return 'none'
    if YOUTUBE_RE.search(url):
        return 'youtube'
    if url.lower().split('?')[0].endswith(DIRECT_VIDEO_EXTS):
        return 'direct'
    return 'other'


def video_is_trackable(lesson):
    return video_kind(lesson) in ('file', 'youtube', 'direct')


def requirement_met(enrollment, lesson):
    """(ok, code). A configured video must have been played for the required share. A lesson with no video
    is never reported as 'watched': it needs the learner's confirmation that the notes were read."""
    row = LessonProgress.objects.filter(enrollment=enrollment, lesson=lesson).first()
    if video_kind(lesson) == 'none':
        return (bool(row and row.notes_read_at), 'read_notes_first')
    return (bool(row and row.video_watched_at), 'watch_first')


def record_video_progress(enrollment, lesson, position, duration):
    """Credit playback time. The server never takes the browser's word for it: credit for a ping is limited by the
    real time since the previous ping, so jumping to the end of a video earns nothing."""
    now = timezone.now()
    row, _ = LessonProgress.objects.get_or_create(enrollment=enrollment, lesson=lesson)
    try:
        position = max(0.0, float(position))
        duration = float(duration)
    except (TypeError, ValueError):
        return row
    if lesson.duration_minutes:
        duration = lesson.duration_minutes * 60.0 if not duration else min(duration, lesson.duration_minutes * 60.0 * 1.5)
    duration = min(max(duration, 0.0), 4 * 3600.0)
    if duration < 5:
        return row
    row.video_duration = duration
    if row.video_last_ping is not None:
        wall = max(0.0, (now - row.video_last_ping).total_seconds())
        moved = position - row.video_last_position
        if 0 < moved:
            row.video_watched_seconds = min(duration, row.video_watched_seconds + min(moved, wall * 1.25 + 1.0))
    row.video_last_position = position
    row.video_last_ping = now
    if row.video_watched_at is None and row.video_watched_seconds >= duration * lesson.video_required_percent / 100.0:
        row.video_watched_at = now
    row.save()
    return row


def video_percent(row):
    if not row or not row.video_duration:
        return 0
    return min(100, int(row.video_watched_seconds * 100 / row.video_duration))


# ── assessment ───────────────────────────────────────────────────────────────

def passing_score_for(lesson):
    return lesson.passing_score or lesson.module.course.passing_score or 75


def passed(score, max_score, threshold):
    return max_score > 0 and (score * 100.0 / max_score) >= threshold


# ── completion, certificate, badges ──────────────────────────────────────────

def new_certificate_number():
    for _ in range(10):
        number = f"LYDO-{timezone.localdate().year}-{''.join(secrets.choice(CERT_ALPHABET) for _ in range(8))}"
        if not Certificate.objects.filter(certificate_number=number).exists():
            return number
    raise RuntimeError('Could not generate a certificate number.')


def _join(items):
    items = [i.strip() for i in items if i and i.strip()]
    if len(items) <= 1:
        return ''.join(items)
    return ', '.join(items[:-1]) + (', and ' if len(items) > 2 else ' and ') + items[-1]


def build_statement(name, course):
    """The sentence printed on the certificate, built from the course's configured learning outcomes."""
    custom = (course.certificate_statement or '').strip()
    if custom:
        return custom.replace('{name}', name).replace('{course}', course.title)
    outcomes = [o for o in (course.learning_outcomes or []) if str(o).strip()]
    base = f'This certificate is awarded to {name} for successfully completing {course.title}'
    if outcomes:
        return f'{base}, demonstrating knowledge and understanding of {_join([str(o) for o in outcomes])}.'
    return f'{base}, completing all of its lessons and passing every lesson assessment.'


def issue_certificate(enrollment):
    """One certificate per completed enrollment. Safe to call again: it never creates a second one.
    The recipient name comes from the enrollment (what the learner typed), not from the account."""
    existing = Certificate.objects.filter(enrollment=enrollment).first()
    if existing:
        return existing, False
    course = enrollment.course
    name = (enrollment.certificate_name or '').strip() or enrollment.user.get_full_name() or enrollment.user.email
    settings_row = CertificateSetting.get()
    modules = list(course.modules.order_by('order').values_list('title', flat=True))
    try:
        with transaction.atomic():
            cert = Certificate.objects.create(
                enrollment=enrollment, certificate_number=new_certificate_number(), recipient_name=name,
                course_title=course.title, audience=course.get_audience_display(),
                statement=build_statement(name, course), outcomes=list(course.learning_outcomes or []),
                modules_summary=modules, signatories=settings_row.signatories(),
                completed_on=timezone.localtime(enrollment.completed_at or timezone.now()).date(),  # the local (Philippine) date
            )
    except IntegrityError:
        return Certificate.objects.get(enrollment=enrollment), False
    return cert, True


def award_course_badges(user, course):
    """Course Completer (first course), a badge for this course, and Learning Streak (3 courses)."""
    from apps.recognition.models import Badge, UserBadge

    completed = Enrollment.objects.filter(user=user, status='completed').count()
    wanted = [
        ('Course Completer', 'Completed your first course on the LYDO learning platform.', 'Complete any one course.', completed >= 1),
        (f'{course.title} Graduate', f'Completed every lesson and assessment of "{course.title}".', f'Complete "{course.title}".', True),
        ('Learning Streak', 'Completed 3 or more courses.', 'Complete 3 courses.', completed >= 3),
    ]
    earned = []
    for name, description, criteria, ok in wanted:
        if not ok:
            continue
        badge, _ = Badge.objects.get_or_create(
            name=name, defaults={'description': description, 'category': 'course', 'criteria': criteria},
        )
        _, created = UserBadge.objects.get_or_create(user=user, badge=badge)
        if created:
            earned.append(name)
    return earned


def recalculate(enrollment):
    """Update progress from the saved lesson records. When every lesson is done the course is completed,
    the certificate is issued and the badges are awarded, once.

    Returns (course_completed_now, certificate_or_None)."""
    lessons = ordered_lessons(enrollment.course)
    total = len(lessons)
    done = len(completed_lesson_ids(enrollment) & {l.id for l in lessons})
    percent = int(done * 100 / total) if total else 0

    just_completed = False
    enrollment.progress_percent = percent
    if total and done >= total:
        if enrollment.status != 'completed':
            just_completed = True
            enrollment.status = 'completed'
            enrollment.completed_at = timezone.now()
    elif done > 0 and enrollment.status != 'completed':
        enrollment.status = 'in_progress'
    enrollment.save(update_fields=['progress_percent', 'status', 'completed_at'])

    certificate = Certificate.objects.filter(enrollment=enrollment).first()
    if just_completed:
        certificate, _ = issue_certificate(enrollment)
        award_course_badges(enrollment.user, enrollment.course)
        _notify_completion(enrollment, certificate)
    return just_completed, certificate


def _notify_completion(enrollment, certificate):
    from apps.notifications.models import Notification

    Notification.objects.create(
        user=enrollment.user,
        title='Course completed',
        message=f'Congratulations! You completed "{enrollment.course.title}". Your certificate ({certificate.certificate_number}) is ready.',
        notification_type='system',
        link='/certificates',
    )


def complete_lesson(enrollment, lesson):
    """Mark one lesson done (only after the caller has checked the assessment) and update the course."""
    row, _ = LessonProgress.objects.get_or_create(enrollment=enrollment, lesson=lesson)
    if not row.completed:
        row.completed = True
        row.completed_at = timezone.now()
        row.save(update_fields=['completed', 'completed_at'])
    return recalculate(enrollment)


def best_attempt(enrollment, lesson):
    """The attempt that counted: the first passing one (it unlocked the lesson), otherwise the latest."""
    attempts = QuizAttempt.objects.filter(enrollment=enrollment, lesson=lesson)
    return attempts.filter(passed=True).order_by('attempted_at').first() or attempts.order_by('-attempted_at').first()
