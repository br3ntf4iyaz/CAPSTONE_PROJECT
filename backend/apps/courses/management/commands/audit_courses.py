"""
Finds duplicate courses (and duplicate modules and lessons inside one course) and, optionally, hides the safe ones.

    python manage.py audit_courses            # report only, changes nothing
    python manage.py audit_courses --apply    # hide duplicate courses that nobody is enrolled in

Rules that keep learners safe:
  * Courses are duplicates only when their titles match after ignoring case, spacing and punctuation.
  * One course per group is kept as the authoritative record: the one with the most enrollments, then the most lessons,
    then the oldest.
  * A duplicate that has enrollments, progress, quiz answers or certificates is NEVER touched. It is listed for a person to
    review, because its lessons are different records and moving progress between them could corrupt it.
  * --apply never deletes anything. It sets is_active=False, so the duplicate disappears from the catalog and can be
    switched back on in the admin.
  * Duplicate modules or lessons inside a course are only reported.
"""
import re
from collections import defaultdict

from django.core.management.base import BaseCommand
from django.db.models import Count

from apps.courses.models import Certificate, Course, CourseModule, Enrollment, Lesson, LessonProgress, QuizAttempt


def norm(text):
    return re.sub(r'[^a-z0-9]+', ' ', (text or '').lower()).strip()


class Command(BaseCommand):
    help = 'Report duplicate courses, modules and lessons; with --apply hide duplicate courses that have no learners.'

    def add_arguments(self, parser):
        parser.add_argument('--apply', action='store_true', help='Hide the safe duplicate courses (never deletes).')

    def handle(self, *args, **opts):
        courses = list(Course.objects.annotate(n_enroll=Count('enrollments', distinct=True),
                                               n_lessons=Count('modules__lessons', distinct=True)).order_by('id'))
        groups = defaultdict(list)
        for c in courses:
            groups[norm(c.title)].append(c)
        dup_groups = {k: v for k, v in groups.items() if k and len(v) > 1}

        self.stdout.write(f'{len(courses)} courses checked, {len(dup_groups)} duplicate group(s) found.')
        hidden = would = needs_review = 0
        for key, members in dup_groups.items():
            keep = sorted(members, key=lambda c: (-c.n_enroll, -c.n_lessons, c.id))[0]
            self.stdout.write(f'\n"{keep.title}": {len(members)} records')
            for c in members:
                tag = 'KEEP' if c.id == keep.id else 'duplicate'
                self.stdout.write(f'  [{tag}] id={c.id} audience={c.audience} active={c.is_active} published={c.is_published} '
                                  f'enrollments={c.n_enroll} lessons={c.n_lessons}')
            for c in members:
                if c.id == keep.id:
                    continue
                busy = (Enrollment.objects.filter(course=c).exists()
                        or LessonProgress.objects.filter(lesson__module__course=c).exists()
                        or QuizAttempt.objects.filter(lesson__module__course=c).exists()
                        or Certificate.objects.filter(enrollment__course=c).exists())
                if busy:
                    needs_review += 1
                    self.stdout.write(self.style.WARNING(f'  -> id={c.id} has learner records. Left untouched: review it by hand.'))
                elif opts['apply']:
                    if c.is_active:
                        c.is_active = False
                        c.save(update_fields=['is_active'])
                    hidden += 1
                    self.stdout.write(self.style.SUCCESS(f'  -> id={c.id} hidden (no learners). Nothing was deleted.'))
                else:
                    would += 1
                    self.stdout.write(f'  -> id={c.id} would be hidden with --apply (no learners).')

        # duplicates inside one course
        inner = 0
        for course in courses:
            seen = defaultdict(list)
            for m in CourseModule.objects.filter(course=course):
                seen[norm(m.title)].append(m.id)
            for key, ids in seen.items():
                if key and len(ids) > 1:
                    inner += 1
                    self.stdout.write(self.style.WARNING(f'Course "{course.title}": module "{key}" appears {len(ids)} times (ids {ids}).'))
            seen = defaultdict(list)
            for l in Lesson.objects.filter(module__course=course):
                seen[norm(l.title)].append(l.id)
            for key, ids in seen.items():
                if key and len(ids) > 1:
                    inner += 1
                    self.stdout.write(self.style.WARNING(f'Course "{course.title}": lesson "{key}" appears {len(ids)} times (ids {ids}).'))

        verb = 'hidden' if opts['apply'] else 'that would be hidden with --apply'
        self.stdout.write(self.style.SUCCESS(
            f'\nDone. Duplicate courses {verb}: {hidden if opts["apply"] else would}. '
            f'Needing a manual look: {needs_review}. Duplicate modules/lessons reported: {inner}.'))
