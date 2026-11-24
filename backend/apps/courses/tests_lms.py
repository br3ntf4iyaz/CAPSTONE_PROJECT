from datetime import timedelta
from unittest import mock

from django.core.management import call_command
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.notifications.models import Notification
from apps.recognition.models import UserBadge

from .models import (
    Certificate, CertificateSetting, Course, CourseModule, Enrollment, Lesson, LessonProgress, Question,
    QuestionChoice, QuizAttempt,
)

CERT_NAME = 'Juan P. Dela Cruz Jr.'
YOUTUBE = 'https://www.youtube.com/watch?v=abcdefghijk'


def make_course(title='Test Course', lessons_per_module=(2, 1), video=None, audience='general_youth',
                outcomes=('digital literacy', 'online safety')):
    course = Course.objects.create(title=title, description='d', category='leadership', is_published=True,
                                   audience=audience, learning_outcomes=list(outcomes))
    lessons = []
    for mi, n in enumerate(lessons_per_module, start=1):
        module = CourseModule.objects.create(course=course, title=f'Module {mi}', order=mi)
        for li in range(1, n + 1):
            lesson = Lesson.objects.create(module=module, title=f'Lesson {mi}.{li}', order=li, content='secret notes',
                                           video_url=video or '')
            for qi in range(1, 5):
                q = Question.objects.create(lesson=lesson, text=f'Q{qi} of {lesson.title}', order=qi, explanation='because')
                for ci in range(1, 5):
                    QuestionChoice.objects.create(question=q, text=f'choice {ci}', order=ci, is_correct=(ci == 2))
            lessons.append(lesson)
    return course, lessons


def answers_for(lesson, wrong=0):
    """All correct, except for `wrong` questions."""
    out = []
    for i, q in enumerate(lesson.questions.order_by('order')):
        want_correct = i >= wrong
        choice = next(c for c in q.choices.order_by('order') if c.is_correct == want_correct)
        out.append({'question_id': q.id, 'choice_id': choice.id})
    return out


class LmsFlowTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email='learner@x.com', password='p', first_name='Account', last_name='Holder',
                                             role='youth', is_active=True)
        self.other = User.objects.create_user(email='other@x.com', password='p', role='youth', is_active=True)
        self.course, self.lessons = make_course()
        self.client.force_authenticate(self.user)
        self.enrollment = self.enroll(self.course)

    def enroll(self, course, name=CERT_NAME):
        r = self.client.post('/api/courses/enrollments/', {'course_id': course.id, 'certificate_name': name}, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        return Enrollment.objects.get(user=self.client.handler._force_user if False else self.user, course=course)

    def prepare(self, lesson):
        """A lesson without a video needs the 'notes read' confirmation before its assessment."""
        r = self.client.post(f'/api/courses/lessons/{lesson.id}/notes-read/')
        self.assertEqual(r.status_code, 200, r.data)

    def submit(self, lesson, wrong=0, answers=None, enrollment=None, prepare=True):
        if prepare:
            self.prepare(lesson)
        enrollment = enrollment or self.enrollment
        return self.client.post(f'/api/courses/lessons/{lesson.id}/submit-quiz/', {
            'enrollment_id': enrollment.id, 'lesson_id': lesson.id,
            'answers': answers if answers is not None else answers_for(lesson, wrong)}, format='json')

    def test_a_failed_attempt_never_reveals_the_answer_key_but_a_pass_does(self):
        lesson = self.lessons[0]
        r = self.submit(lesson, wrong=lesson.questions.count())
        self.assertFalse(r.data['passed'])
        self.assertTrue(r.data['answers'])
        for a in r.data['answers']:
            self.assertFalse(a['is_correct'])
            self.assertIsNone(a['correct_choice_id'])
            self.assertEqual(a['explanation'], '')
        r = self.submit(lesson)
        self.assertTrue(r.data['passed'])
        self.assertTrue(all(a['correct_choice_id'] for a in r.data['answers']))

    def finish_course(self):
        for lesson in self.lessons:
            self.assertTrue(self.submit(lesson).data['passed'])

    # ── enrollment and certificate name ──────────────────────────────────
    def test_enrollment_needs_a_certificate_name_and_saves_it_on_the_enrollment(self):
        course, _ = make_course('Another')
        r = self.client.post('/api/courses/enrollments/', {'course_id': course.id}, format='json')
        self.assertEqual(r.status_code, 400)
        r = self.client.post('/api/courses/enrollments/', {'course_id': course.id, 'certificate_name': '  '}, format='json')
        self.assertEqual(r.status_code, 400)
        r = self.client.post('/api/courses/enrollments/', {'course_id': course.id, 'certificate_name': '12345'}, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertFalse(Enrollment.objects.filter(user=self.user, course=course).exists())
        r = self.client.post('/api/courses/enrollments/', {'course_id': course.id, 'certificate_name': '  Maria   <b>Clara</b>  '}, format='json')
        self.assertEqual(r.status_code, 201)
        self.assertEqual(Enrollment.objects.get(user=self.user, course=course).certificate_name, 'Maria Clara')
        self.user.refresh_from_db()
        self.assertEqual((self.user.first_name, self.user.last_name), ('Account', 'Holder'))  # the account name is untouched

    def test_cannot_enroll_twice_or_in_a_course_without_lessons(self):
        r = self.client.post('/api/courses/enrollments/', {'course_id': self.course.id, 'certificate_name': 'Someone Else'}, format='json')
        self.assertEqual(r.status_code, 400)
        empty = Course.objects.create(title='Empty', description='d', category='tech', is_published=True)
        r = self.client.post('/api/courses/enrollments/', {'course_id': empty.id, 'certificate_name': 'Someone Else'}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_certificate_name_can_be_changed_only_before_the_certificate_exists(self):
        url = f'/api/courses/enrollments/{self.enrollment.id}/certificate-name/'
        self.assertEqual(self.client.patch(url, {'certificate_name': 'Juan Pablo Dela Cruz'}, format='json').status_code, 200)
        self.assertEqual(self.client.patch(url, {'certificate_name': ''}, format='json').status_code, 400)
        self.enrollment.refresh_from_db()
        self.assertEqual(self.enrollment.certificate_name, 'Juan Pablo Dela Cruz')
        self.finish_course()
        r = self.client.patch(url, {'certificate_name': 'Different Name'}, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data['code'], 'certificate_issued')
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.patch(url, {'certificate_name': 'Hacker Name'}, format='json').status_code, 404)

    # ── audience ─────────────────────────────────────────────────────────
    def test_a_general_youth_account_only_sees_and_joins_general_youth_courses(self):
        sk, _ = make_course('SK Course', audience='sk_officials')
        org, _ = make_course('Org Course', audience='youth_org_leaders')
        titles = lambda data: sorted(c['title'] for c in (data['results'] if isinstance(data, dict) else data))
        self.assertEqual(titles(self.client.get('/api/courses/').data), ['Test Course'])
        self.assertEqual(titles(self.client.get('/api/courses/', {'audience': 'sk_officials'}).data), [])
        self.assertEqual(self.client.get('/api/courses/my-audiences/').data['audiences'], ['general_youth'])
        for course in (sk, org):
            self.assertEqual(self.client.get(f'/api/courses/{course.id}/').status_code, 404)
            r = self.client.post('/api/courses/enrollments/', {'course_id': course.id, 'certificate_name': 'Juan Dela Cruz'}, format='json')
            self.assertIn(r.status_code, (403, 400), r.data)
            self.assertFalse(Enrollment.objects.filter(user=self.user, course=course).exists())

    def test_sk_and_org_leader_accounts_get_their_own_track_plus_the_general_courses(self):
        sk, _ = make_course('SK Course', audience='sk_officials')
        org, _ = make_course('Org Course', audience='youth_org_leaders')
        titles = lambda data: sorted(c['title'] for c in (data['results'] if isinstance(data, dict) else data))
        sk_user = User.objects.create_user(email='sk@x.com', password='p', role='youth', youth_type='sk', is_active=True)
        self.client.force_authenticate(sk_user)
        self.assertEqual(titles(self.client.get('/api/courses/').data), ['SK Course', 'Test Course'])
        self.assertEqual(self.client.get('/api/courses/my-audiences/').data['audiences'], ['general_youth', 'sk_officials'])
        self.assertEqual(self.client.post('/api/courses/enrollments/', {'course_id': sk.id, 'certificate_name': 'Juan Dela Cruz'}, format='json').status_code, 201)
        r = self.client.post('/api/courses/enrollments/', {'course_id': org.id, 'certificate_name': 'Juan Dela Cruz'}, format='json')
        self.assertEqual(r.status_code, 403)
        self.assertEqual(r.data['code'], 'audience_mismatch')
        org_user = User.objects.create_user(email='org@x.com', password='p', role='youth', youth_type='youth_org_leader', is_active=True)
        self.client.force_authenticate(org_user)
        self.assertEqual(titles(self.client.get('/api/courses/').data), ['Org Course', 'Test Course'])
        self.assertEqual(self.client.post('/api/courses/enrollments/', {'course_id': sk.id, 'certificate_name': 'Juan Dela Cruz'}, format='json').status_code, 403)
        self.assertEqual(self.client.post('/api/courses/enrollments/', {'course_id': org.id, 'certificate_name': 'Juan Dela Cruz'}, format='json').status_code, 201)

    def test_an_old_enrollment_outside_the_account_tracks_is_hidden_and_closed_but_not_deleted(self):
        sk, sk_lessons = make_course('SK Course', audience='sk_officials')
        # this general account enrolled before the rule existed
        old = Enrollment.objects.create(user=self.user, course=sk, certificate_name='Juan Dela Cruz')
        self.assertFalse(any(e['course']['title'] == 'SK Course' for e in self.client.get('/api/courses/enrollments/').data['results']))
        self.assertEqual(self.client.get(f'/api/courses/{sk.id}/').status_code, 404)
        self.assertEqual(self.client.get(f'/api/courses/enrollments/{old.id}/state/').status_code, 404)
        self.assertEqual(self.client.get(f'/api/courses/lessons/{sk_lessons[0].id}/').status_code, 403)
        r = self.client.post(f'/api/courses/lessons/{sk_lessons[0].id}/submit-quiz/', {
            'enrollment_id': old.id, 'lesson_id': sk_lessons[0].id, 'answers': answers_for(sk_lessons[0])}, format='json')
        self.assertEqual(r.status_code, 404)
        self.assertTrue(Enrollment.objects.filter(pk=old.pk).exists())  # nothing is deleted
        # once the account is an SK account, the same enrollment is back
        self.user.youth_type = 'sk'
        self.user.save()
        self.assertTrue(any(e['course']['title'] == 'SK Course' for e in self.client.get('/api/courses/enrollments/').data['results']))

    def test_admins_and_visitors_see_every_course(self):
        make_course('SK Course', audience='sk_officials')
        self.client.force_authenticate(None)
        self.assertEqual(len(self.client.get('/api/courses/my-audiences/').data['audiences']), 3)
        admin = User.objects.create_user(email='adm@x.com', password='p', role='lgu_admin', is_active=True)
        self.client.force_authenticate(admin)
        self.assertEqual(len(self.client.get('/api/courses/my-audiences/').data['audiences']), 3)
        self.assertEqual(len(self.client.get('/api/courses/').data['results']), 2)

    def test_public_course_detail_does_not_leak_notes_or_videos(self):
        self.client.force_authenticate(None)
        data = self.client.get(f'/api/courses/{self.course.id}/').data
        lesson = data['modules'][0]['lessons'][0]
        self.assertNotIn('content', lesson)
        self.assertNotIn('video_url', lesson)

    # ── locking ──────────────────────────────────────────────────────────
    def test_only_the_first_lesson_is_open_at_the_start(self):
        state = self.client.get(f'/api/courses/enrollments/{self.enrollment.id}/state/').data
        self.assertEqual([l['status'] for m in state['modules'] for l in m['lessons']], ['current', 'locked', 'locked'])
        self.assertEqual(state['certificate_name'], CERT_NAME)

    def test_locked_lesson_cannot_be_opened_or_graded_by_url(self):
        second = self.lessons[1]
        r = self.client.get(f'/api/courses/lessons/{second.id}/')
        self.assertEqual((r.status_code, r.data['code']), (403, 'locked'))
        self.assertEqual(self.client.post(f'/api/courses/lessons/{second.id}/notes-read/').status_code, 403)
        self.assertEqual(self.submit(second, prepare=False).status_code, 403)
        r = self.client.post(f'/api/courses/enrollments/{self.enrollment.id}/mark_lesson_complete/', {'lesson_id': second.id}, format='json')
        self.assertEqual(r.status_code, 403)

    def test_a_lesson_with_an_assessment_cannot_be_completed_without_passing_it(self):
        self.prepare(self.lessons[0])
        r = self.client.post(f'/api/courses/enrollments/{self.enrollment.id}/mark_lesson_complete/', {'lesson_id': self.lessons[0].id}, format='json')
        self.assertEqual((r.status_code, r.data['code']), (400, 'assessment_required'))
        self.assertFalse(LessonProgress.objects.filter(enrollment=self.enrollment, completed=True).exists())

    # ── assessment and passing score ─────────────────────────────────────
    def test_default_passing_score_is_75_percent_and_failing_never_unlocks(self):
        first, second = self.lessons[0], self.lessons[1]
        r = self.submit(first, wrong=2)  # 2 of 4 = 50%
        self.assertFalse(r.data['passed'])
        r = self.submit(first, wrong=1)  # 3 of 4 = 75% -> exactly the passing score
        self.assertTrue(r.data['passed'])
        self.assertEqual(r.data['passing_score'], 75)
        self.assertEqual(r.data['next_lesson_id'], second.id)
        self.assertEqual(QuizAttempt.objects.filter(lesson=first).count(), 2)  # every attempt is kept

    def test_passing_score_can_be_set_per_course_and_per_lesson(self):
        self.course.passing_score = 100
        self.course.save()
        self.assertFalse(self.submit(self.lessons[0], wrong=1).data['passed'])
        self.lessons[0].passing_score = 50
        self.lessons[0].save()
        self.assertTrue(self.submit(self.lessons[0], wrong=2).data['passed'])

    def test_every_question_must_be_answered_and_choices_must_belong_to_the_question(self):
        first = self.lessons[0]
        self.assertEqual(self.submit(first, answers=answers_for(first)[:-1]).status_code, 400)
        wrong = answers_for(first)
        wrong[0]['choice_id'] = QuestionChoice.objects.filter(question__lesson=self.lessons[1]).first().id
        self.assertEqual(self.submit(first, answers=wrong).status_code, 400)
        self.assertFalse(QuizAttempt.objects.exists())

    def test_correct_answers_are_never_sent_to_the_learner_before_submitting(self):
        data = self.client.get(f'/api/courses/lessons/{self.lessons[0].id}/').data
        self.assertEqual(len(data['questions']), 4)
        for q in data['questions']:
            self.assertEqual(len(q['choices']), 4)
            for c in q['choices']:
                self.assertNotIn('is_correct', c)

    def test_quiz_attempts_cannot_be_created_directly(self):
        r = self.client.post('/api/courses/quiz-attempts/', {'enrollment_id': self.enrollment.id, 'score': 99}, format='json')
        self.assertEqual(r.status_code, 405)

    # ── video and reading requirement ────────────────────────────────────
    def test_a_lesson_without_a_video_needs_the_notes_confirmation_and_is_never_called_watched(self):
        first = self.lessons[0]
        r = self.submit(first, prepare=False)
        self.assertEqual((r.status_code, r.data['code']), (400, 'read_notes_first'))
        data = self.client.get(f'/api/courses/lessons/{first.id}/').data
        self.assertEqual(data['video_kind'], 'none')
        self.assertFalse(data['video_watched'])
        self.prepare(first)
        self.assertTrue(self.client.get(f'/api/courses/lessons/{first.id}/').data['requirement_met'])
        self.assertFalse(self.client.get(f'/api/courses/lessons/{first.id}/').data['video_watched'])

    def test_video_playback_is_measured_by_the_server_and_jumping_to_the_end_earns_nothing(self):
        course, lessons = make_course('Video Course', (1,), video=YOUTUBE)
        enr = self.enroll(course)
        lesson = lessons[0]
        url = f'/api/courses/lessons/{lesson.id}/video-progress/'
        r = self.client.post(f'/api/courses/lessons/{lesson.id}/submit-quiz/', {
            'enrollment_id': enr.id, 'lesson_id': lesson.id, 'answers': answers_for(lesson)}, format='json')
        self.assertEqual((r.status_code, r.data['code']), (400, 'watch_first'))
        # a manual "I watched it" is refused for a video the server can measure
        self.assertEqual(self.client.post(f'/api/courses/lessons/{lesson.id}/watched/').status_code, 400)
        start = timezone.now()
        with mock.patch('apps.courses.progress.timezone.now', return_value=start):
            self.client.post(url, {'position': 0, 'duration': 100}, format='json')
        with mock.patch('apps.courses.progress.timezone.now', return_value=start + timedelta(seconds=2)):
            r = self.client.post(url, {'position': 100, 'duration': 100}, format='json')  # skip to the end
        self.assertLess(r.data['video_percent'], 10)
        self.assertFalse(r.data['video_watched'])
        # honest playback: 90 seconds of a 100 second video, in real time
        t = start + timedelta(seconds=2)
        with mock.patch('apps.courses.progress.timezone.now', return_value=t):
            self.client.post(url, {'position': 0, 'duration': 100}, format='json')
        for step in range(1, 10):
            with mock.patch('apps.courses.progress.timezone.now', return_value=t + timedelta(seconds=10 * step)):
                r = self.client.post(url, {'position': 10 * step, 'duration': 100}, format='json')
        self.assertTrue(r.data['video_watched'])
        r = self.client.post(f'/api/courses/lessons/{lesson.id}/submit-quiz/', {
            'enrollment_id': enr.id, 'lesson_id': lesson.id, 'answers': answers_for(lesson)}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data['passed'])

    def test_a_link_the_server_cannot_measure_can_be_confirmed_manually(self):
        course, lessons = make_course('Other Video', (1,), video='https://example.org/some-page')
        enr = self.enroll(course)
        lesson = lessons[0]
        self.assertEqual(self.client.post(f'/api/courses/lessons/{lesson.id}/watched/').status_code, 200)
        r = self.client.post(f'/api/courses/lessons/{lesson.id}/submit-quiz/', {
            'enrollment_id': enr.id, 'lesson_id': lesson.id, 'answers': answers_for(lesson)}, format='json')
        self.assertEqual(r.status_code, 200)

    # ── completion, certificate, badges ──────────────────────────────────
    def test_completion_issues_one_certificate_with_the_enrollment_name_and_course_outcomes(self):
        self.assertEqual(Certificate.objects.count(), 0)
        self.finish_course()
        self.enrollment.refresh_from_db()
        self.assertEqual((self.enrollment.status, self.enrollment.progress_percent), ('completed', 100))
        cert = Certificate.objects.get(enrollment=self.enrollment)
        self.assertEqual(cert.recipient_name, CERT_NAME)
        self.assertEqual(cert.course_title, 'Test Course')
        self.assertEqual(cert.audience, 'General Youth')
        self.assertIn(CERT_NAME, cert.statement)
        self.assertIn('digital literacy and online safety', cert.statement)
        self.assertEqual(cert.modules_summary, ['Module 1', 'Module 2'])
        self.assertTrue(UserBadge.objects.filter(user=self.user, badge__name='Course Completer').exists())
        self.assertTrue(UserBadge.objects.filter(user=self.user, badge__name='Test Course Graduate').exists())
        self.assertTrue(Notification.objects.filter(user=self.user, title='Course completed').exists())

    def test_the_certificate_keeps_its_snapshot_when_the_course_or_account_changes_later(self):
        CertificateSetting.get()
        row = CertificateSetting.get()
        row.signatory_1_name, row.signatory_1_title = 'Maria Santos', 'LYDO Head'
        row.save()
        self.finish_course()
        cert = Certificate.objects.get()
        self.course.title = 'Renamed Course'
        self.course.learning_outcomes = ['something else']
        self.course.save()
        self.user.first_name = 'Changed'
        self.user.save()
        row.signatory_1_name = 'Someone New'
        row.save()
        cert.refresh_from_db()
        self.assertEqual((cert.recipient_name, cert.course_title), (CERT_NAME, 'Test Course'))
        self.assertEqual(cert.signatories, [{'name': 'Maria Santos', 'title': 'LYDO Head'}])
        data = self.client.get(f'/api/courses/certificates/{cert.id}/').data
        self.assertEqual((data['holder_name'], data['course_title']), (CERT_NAME, 'Test Course'))

    def test_a_course_can_use_its_own_certificate_wording(self):
        self.course.certificate_statement = 'Awarded to {name} for finishing {course}.'
        self.course.save()
        self.finish_course()
        self.assertEqual(Certificate.objects.get().statement, f'Awarded to {CERT_NAME} for finishing Test Course.')

    def test_no_certificate_before_the_course_is_complete_and_no_way_to_claim_one(self):
        self.submit(self.lessons[0])
        self.assertEqual(Certificate.objects.count(), 0)
        for method in ('post', 'put', 'patch'):
            self.assertEqual(getattr(self.client, method)('/api/courses/certificates/', {'enrollment': self.enrollment.id}, format='json').status_code, 405)

    def test_retaking_a_passed_lesson_never_creates_a_second_certificate_or_changes_the_date(self):
        self.finish_course()
        self.enrollment.refresh_from_db()
        done = self.enrollment.completed_at
        self.submit(self.lessons[0])
        self.submit(self.lessons[0], wrong=4)
        self.assertEqual(Certificate.objects.count(), 1)
        self.enrollment.refresh_from_db()
        self.assertEqual((self.enrollment.status, self.enrollment.completed_at), ('completed', done))

    def test_certificate_pdf_is_only_for_its_owner(self):
        self.finish_course()
        cert = Certificate.objects.get(enrollment=self.enrollment)
        results = self.client.get('/api/courses/certificates/').data
        results = results['results'] if isinstance(results, dict) else results
        self.assertEqual(results[0]['holder_name'], CERT_NAME)
        r = self.client.get(f'/api/courses/certificates/{cert.id}/pdf/')
        self.assertEqual((r.status_code, r['Content-Type']), (200, 'application/pdf'))
        self.assertTrue(r.content.startswith(b'%PDF'))
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(f'/api/courses/certificates/{cert.id}/pdf/').status_code, 404)
        self.assertEqual(self.client.get(f'/api/courses/certificates/{cert.id}/').status_code, 404)

    # ── review ───────────────────────────────────────────────────────────
    def test_review_is_only_for_completed_courses_and_keeps_every_attempt(self):
        self.assertEqual(self.client.get(f'/api/courses/enrollments/{self.enrollment.id}/review/').status_code, 403)
        self.submit(self.lessons[0], wrong=2)  # first attempt: 50%
        self.finish_course()
        r = self.client.get(f'/api/courses/enrollments/{self.enrollment.id}/review/')
        self.assertEqual(r.status_code, 200)
        first = r.data['lessons'][0]
        self.assertEqual((first['original_score'], first['original_percent']), (2, 50))
        self.assertEqual(len(first['attempts']), 2)
        counted = next(a for a in first['attempts'] if a['id'] == first['counted_attempt_id'])
        self.assertTrue(counted['passed'])
        wrong_answer = next(a for a in first['attempts'][0]['answers'] if not a['is_correct'])
        self.assertEqual(sum(1 for c in wrong_answer['choices'] if c['is_correct']), 1)
        self.assertEqual(len(wrong_answer['choices']), 4)
        self.assertEqual(r.data['certificate_name'], CERT_NAME)

    def test_reviewing_changes_nothing(self):
        self.finish_course()
        snap = lambda: (QuizAttempt.objects.count(), Certificate.objects.count(), LessonProgress.objects.filter(completed=True).count(),
                        Enrollment.objects.get(pk=self.enrollment.pk).completed_at)
        before = snap()
        self.client.get(f'/api/courses/enrollments/{self.enrollment.id}/review/')
        self.client.get(f'/api/courses/enrollments/{self.enrollment.id}/state/')
        self.assertEqual(before, snap())

    def test_other_users_cannot_see_my_progress_or_answers(self):
        self.finish_course()
        self.client.force_authenticate(self.other)
        for suffix in ('state', 'review'):
            self.assertEqual(self.client.get(f'/api/courses/enrollments/{self.enrollment.id}/{suffix}/').status_code, 404)

    def test_progress_is_independent_per_user(self):
        self.submit(self.lessons[0])
        self.client.force_authenticate(self.other)
        mine = self.client.post('/api/courses/enrollments/', {'course_id': self.course.id, 'certificate_name': 'Other Person'}, format='json')
        self.assertEqual(mine.status_code, 201)
        state = self.client.get(f"/api/courses/enrollments/{mine.data['id']}/state/").data
        self.assertEqual(state['completed_lessons'], 0)
        self.assertEqual(state['modules'][0]['lessons'][0]['status'], 'current')

    def test_my_learning_cards_have_counts_status_and_the_current_lesson(self):
        self.submit(self.lessons[0])
        card = self.client.get('/api/courses/enrollments/').data
        card = (card['results'] if isinstance(card, dict) else card)[0]
        self.assertEqual((card['completed_lessons'], card['total_lessons'], card['learning_status']), (1, 3, 'in_progress'))
        self.assertEqual(card['current_lesson_title'], 'Lesson 1.2')
        self.assertEqual(card['course']['audience'], 'general_youth')


class AdminLmsTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(email='ad@x.com', password='p', role='lgu_admin', is_active=True)
        self.user = User.objects.create_user(email='u@x.com', password='p', role='youth', is_active=True)
        self.course, self.lessons = make_course('Admin Course')

    def test_only_admins_see_certificates_settings_and_verification(self):
        self.client.force_authenticate(self.user)
        for url in ('/api/courses/admin/certificates/', '/api/courses/admin/certificate-settings/'):
            self.assertEqual(self.client.get(url).status_code, 403)

    def test_admin_can_set_signatories_and_verify_a_certificate_number(self):
        self.client.force_authenticate(self.admin)
        r = self.client.put('/api/courses/admin/certificate-settings/', {'signatory_1_name': 'Maria <b>Santos</b>', 'signatory_1_title': 'LYDO Head'}, format='json')
        self.assertEqual((r.status_code, r.data['signatory_1_name']), (200, 'Maria Santos'))
        self.assertEqual(self.client.put('/api/courses/admin/certificate-settings/', {'organization_name': ''}, format='json').status_code, 400)
        enrollment = Enrollment.objects.create(user=self.user, course=self.course, certificate_name='Ana Reyes')
        from . import progress
        enrollment.status = 'completed'
        enrollment.completed_at = timezone.now()
        enrollment.save()
        cert, _ = progress.issue_certificate(enrollment)
        listing = self.client.get('/api/courses/admin/certificates/', {'q': 'Ana'}).data
        self.assertEqual(len(listing), 1)
        ok = self.client.get('/api/courses/admin/certificates/verify/', {'number': cert.certificate_number.lower()}).data
        self.assertTrue(ok['valid'])
        self.assertEqual(ok['certificate']['holder_name'], 'Ana Reyes')
        self.assertFalse(self.client.get('/api/courses/admin/certificates/verify/', {'number': 'LYDO-0000-NOPE'}).data['valid'])
        self.assertEqual(cert.signatories, [{'name': 'Maria Santos', 'title': 'LYDO Head'}])

    def test_admin_sets_audience_outcomes_and_passing_score_when_creating_a_course(self):
        self.client.force_authenticate(self.admin)
        r = self.client.post('/api/courses/admin/courses/', {
            'title': 'New SK Course', 'description': 'd', 'category': 'finance', 'audience': 'sk_officials',
            'learning_outcomes': ['budget planning', '<b>financial reporting</b>'], 'passing_score': 80}, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data['audience'], 'sk_officials')
        self.assertEqual(r.data['learning_outcomes'], ['budget planning', 'financial reporting'])

    def test_questions_need_four_choices_with_one_correct_and_editing_keeps_saved_answers(self):
        self.client.force_authenticate(self.admin)
        base = f'/api/courses/admin/courses/{self.course.id}/modules/{self.lessons[0].module_id}/lessons/{self.lessons[0].id}/questions/'
        three = {'text': 'Q?', 'explanation': 'e', 'choices': [{'text': 'a', 'is_correct': True}, {'text': 'b'}, {'text': 'c'}]}
        self.assertEqual(self.client.post(base, three, format='json').status_code, 400)
        two_right = {'text': 'Q?', 'explanation': 'e', 'choices': [{'text': t, 'is_correct': True} for t in 'abcd']}
        self.assertEqual(self.client.post(base, two_right, format='json').status_code, 400)
        good = {'text': 'Q?', 'explanation': 'e', 'choices': [{'text': 'a', 'is_correct': True}] + [{'text': t, 'is_correct': False} for t in 'bcd']}
        created = self.client.post(base, good, format='json')
        self.assertEqual(created.status_code, 201, created.data)
        # a learner answers it, then the admin edits the question: the saved answer must survive
        from .models import QuizAttemptAnswer
        enrollment = Enrollment.objects.create(user=self.user, course=self.course, certificate_name='Ana Reyes')
        attempt = QuizAttempt.objects.create(enrollment=enrollment, lesson=self.lessons[0], score=0, max_score=1)
        question = Question.objects.get(pk=created.data['id'])
        picked = question.choices.first()
        QuizAttemptAnswer.objects.create(attempt=attempt, question=question, selected_choice=picked, is_correct=True)
        edit = dict(good, text='Edited?', choices=[{'text': 'a2', 'is_correct': True}] + [{'text': t + '2', 'is_correct': False} for t in 'bcd'])
        r = self.client.patch(f"{base}{created.data['id']}/", edit, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertTrue(QuizAttemptAnswer.objects.filter(pk__isnull=False, selected_choice=picked).exists())
        # a question that learners answered cannot be deleted (their review depends on it)
        self.assertEqual(self.client.delete(f"{base}{created.data['id']}/").status_code, 409)


class SeedLmsContentTests(APITestCase):
    def test_fills_generic_lessons_adds_missing_ones_labels_the_audience_and_removes_the_unrelated_video(self):
        course = Course.objects.create(title='SK Governance Fundamentals', description='d', category='governance', is_published=True)
        module = CourseModule.objects.create(course=course, title='Introduction to the SK', order=1)
        generic = Lesson.objects.create(module=module, title='Lesson 1.1: Core Concept 1', order=1, content='x',
                                        video_url='https://www.youtube.com/watch?v=dQw4w9WgXcQ')
        call_command('seed_lms_content', verbosity=0)
        generic.refresh_from_db()
        course.refresh_from_db()
        self.assertNotIn('Core Concept', generic.title)
        self.assertEqual(generic.video_url, '')
        self.assertEqual(course.audience, 'sk_officials')
        self.assertIn('public accountability and transparency', course.learning_outcomes)
        self.assertGreaterEqual(course.modules.count(), 3)
        org = Course.objects.get(title='Youth Organization Management')
        self.assertEqual((org.audience, org.is_published), ('youth_org_leaders', True))
        self.assertEqual(Lesson.objects.filter(module__course=org).count(), 9)
        for lesson in Lesson.objects.filter(module__course__in=[course, org]):
            self.assertTrue(lesson.questions.exists(), lesson.title)
            for q in lesson.questions.all():
                self.assertEqual(q.choices.count(), 4)
                self.assertEqual(q.choices.filter(is_correct=True).count(), 1)
        n = Question.objects.count()
        call_command('seed_lms_content', verbosity=0)
        self.assertEqual(Question.objects.count(), n)
        self.assertEqual(Course.objects.filter(title='Youth Organization Management').count(), 1)

    def test_old_inaccurate_sk_text_is_replaced_unless_learners_already_answered_it(self):
        course = Course.objects.create(title='Financial Literacy for SK', description='d', category='finance', is_published=True)
        module = CourseModule.objects.create(course=course, title='Module 1: Financial Literacy for SK Part 1', order=1)
        old = ('Under RA 10742, the SK receives 10% of the barangay annual Internal Revenue Allotment (IRA). '
               '60% Programs, Projects, and Activities (PPAs), 20% Youth Development Fund (YDF), 20% Administrative expenses.')
        answered = Lesson.objects.create(module=module, title='Understanding the SK Budget', order=1, content=old)
        open_lesson = Lesson.objects.create(module=module, title='How SK Funds Are Allocated', order=2, content=old)
        for lesson in (answered, open_lesson):
            qq = Question.objects.create(lesson=lesson, text='Old question?', order=1)
            for i in range(1, 5):
                QuestionChoice.objects.create(question=qq, text=f'c{i}', order=i, is_correct=(i == 1))
        user = User.objects.create_user(email='z@x.com', password='p', role='youth', is_active=True)
        enrollment = Enrollment.objects.create(user=user, course=course, certificate_name='Zed Name')
        QuizAttempt.objects.create(enrollment=enrollment, lesson=answered, score=1, max_score=1, passed=True)
        call_command('seed_lms_content', verbosity=0)
        answered.refresh_from_db()
        open_lesson.refresh_from_db()
        self.assertIn('IRA', answered.content)  # graded learners keep what they were graded on
        self.assertNotIn('60%', open_lesson.content)
        self.assertNotIn('Internal Revenue Allotment', open_lesson.content)
        self.assertEqual(open_lesson.title, 'Understanding SK Financial Responsibilities')
        self.assertIn('ten percent (10%) of the general fund', open_lesson.content)
        self.assertFalse(open_lesson.questions.filter(text='Old question?').exists())
        module.refresh_from_db()
        # the module keeps its title because learners already answered a lesson in it
        self.assertEqual(module.title, 'Module 1: Financial Literacy for SK Part 1')

    def test_sk_course_text_matches_the_law_it_cites(self):
        from .lms_content_sk import COURSES
        text = ' '.join(l['content'] for c in COURSES for m in c['modules'] for l in m['lessons'])
        normal = text.replace('ten percent (10%)', '10%').lower()
        for must in ('10% of the general fund', 'not more than **25%**', '**15%**', 'september 15', 'october 16'):
            self.assertIn(must, normal)
        for wrong in ('60%', 'Youth Development Fund', 'GYCED'):
            self.assertNotIn(wrong, text)

    def test_does_not_overwrite_a_lesson_an_admin_already_edited_or_an_audience_an_admin_chose(self):
        course = Course.objects.create(title='SK Governance Fundamentals', description='d', category='governance',
                                       is_published=True, audience='youth_org_leaders', learning_outcomes=['my outcome'])
        module = CourseModule.objects.create(course=course, title='Introduction to the SK', order=1)
        mine = Lesson.objects.create(module=module, title='My own lesson title', order=1, content='my notes')
        call_command('seed_lms_content', verbosity=0)
        mine.refresh_from_db()
        course.refresh_from_db()
        self.assertEqual((mine.title, mine.content), ('My own lesson title', 'my notes'))
        self.assertEqual((course.audience, course.learning_outcomes), ('youth_org_leaders', ['my outcome']))


class LessonMediaTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(email='ad2@x.com', password='p', role='lgu_admin', is_active=True)
        self.user = User.objects.create_user(email='u2@x.com', password='p', role='youth', is_active=True)

    def test_every_media_entry_points_to_a_real_seed_lesson_with_clean_links(self):
        from .lms_content import CONTENT
        from .lms_content_extra import merge
        from .lms_content_org import MODULES, TITLE
        from .lms_content_sk import COURSES
        from .lms_media import MEDIA
        content = merge({k: dict(v) for k, v in CONTENT.items()})
        for c in COURSES:
            content[c['title']] = {'modules': c['modules']}
        content[TITLE] = {'modules': MODULES}
        lessons = {(t, l['title']) for t, d in content.items() for m in d['modules'] for l in m['lessons']}
        urls = set()
        for key, media in MEDIA.items():
            self.assertIn(key, lessons)
            for r in media.get('resources', []):
                self.assertTrue(r['url'].startswith('https://'), r)
                self.assertTrue(r['title'].strip())
            v = media.get('video')
            if v:
                self.assertRegex(v['url'], r'^https://www\.youtube\.com/watch\?v=[A-Za-z0-9_-]{11}$')
                self.assertTrue(v['title'].strip().endswith(')'), 'the channel must be named')
                urls.add(v['url'])
        self.assertGreater(len(urls), 5)

    def test_seed_attaches_videos_and_study_materials_but_never_overwrites_an_admin_choice(self):
        call_command('seed_lms_content', verbosity=0)
        goal = Lesson.objects.get(title='Goal Setting and Planning')
        self.assertIn('youtube.com/watch?v=', goal.video_url)
        self.assertIn('SMART Goals', goal.video_title)
        decision = Lesson.objects.get(title='Effective Decision-Making')
        self.assertEqual(decision.video_url, '')  # no good video found: reading materials instead
        self.assertTrue(decision.study_resources)
        # the administrator changes one lesson, then the seed runs again
        goal.video_url, goal.video_title, goal.study_resources = 'https://www.youtube.com/watch?v=aaaaaaaaaaa', 'My own video', [{'title': 'Mine', 'url': 'https://example.org/x', 'source': ''}]
        goal.save()
        call_command('seed_lms_content', verbosity=0)
        goal.refresh_from_db()
        self.assertEqual((goal.video_title, len(goal.study_resources)), ('My own video', 1))

    def test_admin_can_set_video_topic_link_and_study_links_and_learner_sees_them(self):
        course, lessons = make_course('Media Course', (1,))
        self.client.force_authenticate(self.admin)
        url = f'/api/courses/admin/courses/{course.id}/modules/{lessons[0].module_id}/lessons/{lessons[0].id}/'
        bad = self.client.patch(url, {'study_resources': [{'title': 'x', 'url': 'javascript:alert(1)'}]}, format='json')
        self.assertEqual(bad.status_code, 400)
        r = self.client.patch(url, {
            'video_url': YOUTUBE, 'video_title': 'The <b>topic</b> to watch', 'video_manual_confirm': True,
            'study_resources': [{'title': 'Read <i>this</i>', 'url': 'https://example.org/read', 'source': 'Example'}]}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data['video_title'], 'The topic to watch')
        self.assertEqual(r.data['study_resources'][0]['title'], 'Read this')
        # the learner sees the topic and the links, and a link marked manual is confirmed by hand
        self.client.force_authenticate(self.user)
        enr = self.client.post('/api/courses/enrollments/', {'course_id': course.id, 'certificate_name': 'Some Learner'}, format='json')
        self.assertEqual(enr.status_code, 201)
        data = self.client.get(f'/api/courses/lessons/{lessons[0].id}/').data
        self.assertEqual((data['video_title'], data['video_kind']), ('The topic to watch', 'other'))
        self.assertEqual(data['study_resources'][0]['url'], 'https://example.org/read')
        self.assertEqual(self.client.post(f'/api/courses/lessons/{lessons[0].id}/watched/').status_code, 200)


class QuestionBankTests(APITestCase):
    """Every seeded lesson has a 10-question assessment, and the extra questions are well formed."""

    def test_extra_questions_are_well_formed(self):
        from .management.commands.seed_lms_content import load_more_questions
        more = load_more_questions()
        self.assertTrue(more)
        for (course, lesson), qs in more.items():
            texts = [q['text'] for q in qs]
            self.assertEqual(len(texts), len(set(texts)), (course, lesson, 'duplicate question'))
            for q in qs:
                self.assertEqual(len(q['choices']), 4, (course, lesson, q['text']))
                self.assertEqual(sum(1 for _, ok in q['choices'] if ok), 1, (course, lesson, q['text']))
                self.assertEqual(len({c.strip().lower() for c, _ in q['choices']}), 4, (course, lesson, q['text'], 'repeated choice'))
                self.assertTrue(q['explanation'].strip(), (course, lesson, q['text']))

    def test_every_seeded_lesson_ends_with_ten_questions_and_seeding_twice_adds_nothing(self):
        for title in ('Leadership Fundamentals', 'Youth Governance 101', 'Communication Skills for Leaders', 'Financial Literacy for SK',
                      'Digital Skills for Youth Leaders', 'SK Governance Fundamentals', 'Youth Leadership and Communication'):
            Course.objects.get_or_create(title=title, defaults={'description': 'x', 'is_published': True})
        call_command('seed_lms_content', verbosity=0)
        counts = {l.id: l.questions.count() for l in Lesson.objects.all()}
        self.assertTrue(counts)
        self.assertTrue(all(n == 10 for n in counts.values()), {l.title: l.questions.count() for l in Lesson.objects.all() if l.questions.count() != 10})
        call_command('seed_lms_content', verbosity=0)
        self.assertEqual(counts, {l.id: l.questions.count() for l in Lesson.objects.all()})
