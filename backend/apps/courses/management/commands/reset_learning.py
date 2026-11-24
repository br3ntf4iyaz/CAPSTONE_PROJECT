"""
Starts one account's course progress over, so its lessons and assessments have to be answered again.

    python manage.py reset_learning --email someone@example.com             # shows what would be reset, changes nothing
    python manage.py reset_learning --email someone@example.com --yes       # does it
    python manage.py reset_learning --email someone@example.com --course "Digital Skills for Youth Leaders" --yes

For each enrollment of that ONE account (or the one course named) it removes the lesson progress, the quiz attempts and their
answers, the certificate (and the matching recognition certificate), and the course badges earned from those courses.
The enrollment itself stays, with the same certificate name, back at 0% so the learner can start again.

Nothing about any other account is touched. Without --yes it only reports.
"""
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.accounts.models import User
from apps.courses.access import restrict_enrollments
from apps.courses.models import Certificate, Enrollment, LessonProgress, QuizAttempt


class Command(BaseCommand):
    help = "Reset one account's course progress (lessons, assessments, certificates) so it can be done again."

    def add_arguments(self, parser):
        parser.add_argument('--email', required=True, help='The account to reset (exact email).')
        parser.add_argument('--course', help='Only this course (exact title). Default: every course of the account.')
        parser.add_argument('--yes', action='store_true', help='Really do it. Without this the command only reports.')
        parser.add_argument('--remove-ineligible', action='store_true',
                            help="Also delete enrollments in courses outside the account's tracks (they are hidden anyway).")

    def handle(self, *args, **opts):
        user = User.objects.filter(email__iexact=opts['email'].strip()).first()
        if user is None:
            raise CommandError('No account with that email.')
        enrollments = Enrollment.objects.filter(user=user).select_related('course')
        if opts['course']:
            enrollments = enrollments.filter(course__title=opts['course'])
        enrollments = list(enrollments)
        if not enrollments:
            raise CommandError('That account has no matching enrollments.')

        eligible_ids = set(restrict_enrollments(Enrollment.objects.filter(user=user), user).values_list('id', flat=True))
        self.stdout.write(f'Account: {user.email} ({user.get_full_name() or "no name"}, type {getattr(user, "youth_type", "")})')
        for e in enrollments:
            self.stdout.write(
                f'  - {e.course.title} [{e.course.get_audience_display()}] status={e.status} progress={e.progress_percent}% '
                f'lessons_done={LessonProgress.objects.filter(enrollment=e, completed=True).count()} '
                f'attempts={QuizAttempt.objects.filter(enrollment=e).count()} '
                f'certificate={"yes" if Certificate.objects.filter(enrollment=e).exists() else "no"}'
                f'{"" if e.id in eligible_ids else "  (outside this account type: hidden)"}')

        if not opts['yes']:
            self.stdout.write(self.style.WARNING('\nNothing changed. Add --yes to reset the enrollments listed above.'))
            return

        from apps.recognition.models import Certificate as RecognitionCertificate, UserBadge
        with transaction.atomic():
            ids = [e.id for e in enrollments]
            n_progress = LessonProgress.objects.filter(enrollment_id__in=ids).delete()[0]
            n_attempts = QuizAttempt.objects.filter(enrollment_id__in=ids).delete()[0]  # answers go with them
            n_cert = Certificate.objects.filter(enrollment_id__in=ids).delete()[0]
            n_rcert = RecognitionCertificate.objects.filter(enrollment_id__in=ids).delete()[0]
            titles = [e.course.title for e in enrollments]
            badge_names = [f'{t} Graduate' for t in titles]
            # "Course Completer" and "Learning Streak" depend on how many courses are finished, so only keep what is still true
            still_done = Enrollment.objects.filter(user=user, status='completed').exclude(id__in=ids).count()
            if still_done < 1:
                badge_names.append('Course Completer')
            if still_done < 3:
                badge_names.append('Learning Streak')
            n_badges = UserBadge.objects.filter(user=user, badge__category='course', badge__name__in=badge_names).delete()[0]
            Enrollment.objects.filter(id__in=ids).update(status='enrolled', progress_percent=0, completed_at=None)
            removed = 0
            if opts['remove_ineligible']:
                bad = [e for e in enrollments if e.id not in eligible_ids]
                removed = len(bad)
                Enrollment.objects.filter(id__in=[e.id for e in bad]).delete()
        self.stdout.write(self.style.SUCCESS(
            f'Reset {len(enrollments)} enrollment(s): {n_progress} lesson record(s), {n_attempts} assessment record(s), '
            f'{n_cert} certificate(s), {n_rcert} recognition certificate(s), {n_badges} course badge(s) removed'
            f'{f", {removed} ineligible enrollment(s) deleted" if removed else ""}. The enrollments are back at 0%.'))
