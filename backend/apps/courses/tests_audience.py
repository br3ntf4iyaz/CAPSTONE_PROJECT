"""Acceptance tests for the three learning tracks: General Youth, SK Officials and Youth Organization Leaders."""
from io import StringIO

from django.core.management import call_command
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.recognition.models import UserBadge

from .models import Certificate, Course, Enrollment, QuizAttempt
from .tests_lms import answers_for, make_course


class AudienceAcceptanceTests(APITestCase):
    """Three accounts x three audiences: courses, lessons, quizzes, certificates, search, enrollment and direct URLs."""

    def setUp(self):
        self.courses = {}
        self.lessons = {}
        for audience, title in (('general_youth', 'General Course'), ('sk_officials', 'SK Course'), ('youth_org_leaders', 'Org Course')):
            self.courses[audience], lessons = make_course(title, (1,), audience=audience)
            self.lessons[audience] = lessons[0]
        self.accounts = {
            'general': User.objects.create_user(email='g@x.com', password='p', role='youth', youth_type='general_youth', is_active=True),
            'sk': User.objects.create_user(email='s@x.com', password='p', role='youth', youth_type='sk', is_active=True),
            'org': User.objects.create_user(email='o@x.com', password='p', role='youth', youth_type='youth_org_leader', is_active=True),
        }
        # who may use which audience (the rule from the specification)
        self.expect = {
            'general': {'general_youth': True, 'sk_officials': False, 'youth_org_leaders': False},
            'sk': {'general_youth': True, 'sk_officials': True, 'youth_org_leaders': False},
            'org': {'general_youth': True, 'sk_officials': False, 'youth_org_leaders': True},
        }

    def titles(self, data):
        return sorted(c['title'] for c in (data['results'] if isinstance(data, dict) else data))

    def test_every_account_sees_and_can_use_exactly_its_own_tracks(self):
        rows = []
        for who, user in self.accounts.items():
            self.client.force_authenticate(user)
            catalog = self.titles(self.client.get('/api/courses/').data)
            searched = self.titles(self.client.get('/api/courses/', {'search': 'Course'}).data)
            want_titles = sorted(self.courses[a].title for a, ok in self.expect[who].items() if ok)
            self.assertEqual(catalog, want_titles, who)
            self.assertEqual(searched, want_titles, f'{who} search')
            for audience, ok in self.expect[who].items():
                course, lesson = self.courses[audience], self.lessons[audience]
                detail = self.client.get(f'/api/courses/{course.id}/').status_code
                enroll = self.client.post('/api/courses/enrollments/', {'course_id': course.id, 'certificate_name': 'Test Person'}, format='json').status_code
                # a row can exist for an ineligible course (old data): it must still be closed
                enrollment = Enrollment.objects.filter(user=user, course=course).first() or \
                    Enrollment.objects.create(user=user, course=course, certificate_name='Test Person')
                lesson_get = self.client.get(f'/api/courses/lessons/{lesson.id}/').status_code
                quiz = self.client.post(f'/api/courses/lessons/{lesson.id}/submit-quiz/', {
                    'enrollment_id': enrollment.id, 'lesson_id': lesson.id, 'answers': answers_for(lesson)}, format='json').status_code
                state = self.client.get(f'/api/courses/enrollments/{enrollment.id}/state/').status_code
                if ok:
                    self.assertEqual((detail, enroll, lesson_get, state), (200, 201, 200, 200), (who, audience))
                    self.assertNotIn(quiz, (403, 404), (who, audience))  # reaches the grader (a notes confirmation may still be asked)
                else:
                    self.assertEqual(detail, 404, (who, audience))
                    self.assertEqual(enroll, 403, (who, audience))
                    self.assertEqual(lesson_get, 403, (who, audience))
                    self.assertEqual(quiz, 404, (who, audience))
                    self.assertEqual(state, 404, (who, audience))
                rows.append((who, audience, 'YES' if ok else 'NO', detail, enroll, lesson_get, quiz))
            mine = sorted(e['course']['title'] for e in self.client.get('/api/courses/enrollments/').data['results'])
            self.assertEqual(mine, want_titles, f'{who} My Learning')
        print('\n  account | audience          | allowed | course | enroll | lesson | quiz')
        for r in rows:
            print('  %-7s | %-17s | %-7s | %-6s | %-6s | %-6s | %s' % r)

    def test_certificates_and_dashboard_count_follow_the_same_rule(self):
        for who, user in self.accounts.items():
            for audience, course in self.courses.items():
                e = Enrollment.objects.create(user=user, course=course, status='completed', certificate_name='Test Person')
                Certificate.objects.create(
                    enrollment=e, certificate_number=f'LYDO-{who}-{audience}', recipient_name='Test Person',
                    course_title=course.title, audience=course.get_audience_display(), completed_on=timezone.now().date())
        for who, user in self.accounts.items():
            self.client.force_authenticate(user)
            want = sorted(self.courses[a].title for a, ok in self.expect[who].items() if ok)
            got = sorted(c['course_title'] for c in self.client.get('/api/courses/certificates/').data['results'])
            self.assertEqual(got, want, who)
            for a in [a for a, ok in self.expect[who].items() if not ok]:
                cert = Certificate.objects.get(certificate_number=f'LYDO-{who}-{a}')
                self.assertEqual(self.client.get(f'/api/courses/certificates/{cert.id}/').status_code, 404)
                self.assertEqual(self.client.get(f'/api/courses/certificates/{cert.id}/pdf/').status_code, 404)
            self.assertEqual(self.client.get('/api/stats/dashboard/').data['courses_enrolled'], len(want), who)

    def test_changing_a_course_audience_tells_the_admin_how_many_learners_it_hides(self):
        admin = User.objects.create_user(email='adm2@x.com', password='p', role='lgu_admin', is_active=True)
        Enrollment.objects.create(user=self.accounts['general'], course=self.courses['general_youth'], certificate_name='A B')
        Enrollment.objects.create(user=self.accounts['sk'], course=self.courses['general_youth'], certificate_name='A B')
        self.client.force_authenticate(admin)
        r = self.client.patch(f"/api/courses/admin/courses/{self.courses['general_youth'].id}/", {'audience': 'sk_officials'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data['audience_change'], {'from': 'general_youth', 'to': 'sk_officials', 'hidden_enrollments': 1})
        # the general learner no longer sees it, the SK learner still does, and nothing was deleted
        self.client.force_authenticate(self.accounts['general'])
        self.assertEqual(self.client.get('/api/courses/enrollments/').data['results'], [])
        self.assertEqual(Enrollment.objects.filter(course=self.courses['general_youth']).count(), 2)

    def test_duplicate_audit_hides_only_duplicates_without_learners(self):
        keep = self.courses['general_youth']
        empty_dup = Course.objects.create(title='  general course ', description='d', is_published=True, audience='general_youth')
        busy_dup = Course.objects.create(title='GENERAL  COURSE', description='d', is_published=True, audience='general_youth')
        Enrollment.objects.create(user=self.accounts['general'], course=keep, certificate_name='A B')
        Enrollment.objects.create(user=self.accounts['sk'], course=busy_dup, certificate_name='A B')
        out = StringIO()
        call_command('audit_courses', stdout=out)
        empty_dup.refresh_from_db()
        self.assertTrue(empty_dup.is_active)  # report only
        call_command('audit_courses', '--apply', stdout=out)
        empty_dup.refresh_from_db()
        busy_dup.refresh_from_db()
        keep.refresh_from_db()
        self.assertFalse(empty_dup.is_active)
        self.assertTrue(busy_dup.is_active)  # has a learner: left for a person to review
        self.assertTrue(keep.is_active)
        self.assertEqual(Course.objects.filter(pk=empty_dup.pk).count(), 1)  # never deleted

    def test_reset_learning_restarts_one_account_only(self):
        a, b = self.accounts['general'], self.accounts['sk']
        course, lesson = self.courses['general_youth'], self.lessons['general_youth']
        for user in (a, b):
            self.client.force_authenticate(user)
            enr = self.client.post('/api/courses/enrollments/', {'course_id': course.id, 'certificate_name': 'Test Person'}, format='json')
            self.assertEqual(enr.status_code, 201)
            self.client.post(f'/api/courses/lessons/{lesson.id}/notes-read/')
            r = self.client.post(f'/api/courses/lessons/{lesson.id}/submit-quiz/', {
                'enrollment_id': enr.data['id'], 'lesson_id': lesson.id, 'answers': answers_for(lesson)}, format='json')
            self.assertTrue(r.data['passed'])
        self.assertEqual(Certificate.objects.count(), 2)
        out = StringIO()
        call_command('reset_learning', '--email', 'g@x.com', stdout=out)  # report only
        self.assertEqual(Certificate.objects.count(), 2)
        call_command('reset_learning', '--email', 'g@x.com', '--yes', stdout=out)
        ea = Enrollment.objects.get(user=a, course=course)
        eb = Enrollment.objects.get(user=b, course=course)
        self.assertEqual((ea.status, ea.progress_percent, ea.completed_at, ea.certificate_name), ('enrolled', 0, None, 'Test Person'))
        self.assertFalse(Certificate.objects.filter(enrollment=ea).exists())
        self.assertFalse(QuizAttempt.objects.filter(enrollment=ea).exists())
        self.assertEqual(eb.status, 'completed')  # the other account is untouched
        self.assertTrue(Certificate.objects.filter(enrollment=eb).exists())
        self.assertTrue(QuizAttempt.objects.filter(enrollment=eb).exists())
        self.assertFalse(UserBadge.objects.filter(user=a).exists())
        self.assertTrue(UserBadge.objects.filter(user=b).exists())
