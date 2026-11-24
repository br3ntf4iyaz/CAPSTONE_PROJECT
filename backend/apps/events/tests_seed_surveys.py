from django.core.management import call_command
from django.core.management.base import CommandError
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.events.models import Survey, SurveyQuestion
from apps.events.serializers import SurveyQuestionSerializer


class SeedSurveysTests(APITestCase):
    def make_admin(self):
        self.admin = User.objects.create_user(email='ad@x.com', password='p', role='lgu_admin', is_active=True)

    def test_needs_an_admin(self):
        with self.assertRaises(CommandError):
            call_command('seed_surveys')

    def test_adds_surveys_once_and_every_choice_question_can_be_answered(self):
        self.make_admin()
        call_command('seed_surveys')
        n = Survey.objects.count()
        self.assertGreaterEqual(n, 6)
        call_command('seed_surveys')
        self.assertEqual(Survey.objects.count(), n)
        for q in SurveyQuestion.objects.filter(question_type='multiple_choice'):
            self.assertGreaterEqual(len(q.choices), 2, q.question)

    def test_questions_saved_without_choices_are_repaired_so_nobody_is_stuck(self):
        self.make_admin()
        s = Survey.objects.create(title='Old', created_by=self.admin)
        a = SurveyQuestion.objects.create(survey=s, question='Which area should LYDO focus on most in 2025?', question_type='multiple_choice', order=1)
        b = SurveyQuestion.objects.create(survey=s, question='Would you attend again next year?', question_type='multiple_choice', order=2)
        c = SurveyQuestion.objects.create(survey=s, question='Some unknown question', question_type='multiple_choice', order=3)
        call_command('seed_surveys')
        for q in (a, b, c):
            q.refresh_from_db()
        self.assertEqual(a.question_type, 'multiple_choice')
        self.assertGreaterEqual(len(a.choices), 2)
        self.assertEqual(b.question_type, 'yes_no')
        self.assertEqual(c.question_type, 'text')  # becomes a written answer rather than a dead end

    def test_a_multiple_choice_question_must_have_choices(self):
        bad = SurveyQuestionSerializer(data={'question': 'Pick one', 'question_type': 'multiple_choice', 'choices': ['only one'], 'order': 1})
        self.assertFalse(bad.is_valid())
        ok = SurveyQuestionSerializer(data={'question': 'Pick one', 'question_type': 'multiple_choice', 'choices': ['a', ' b '], 'order': 1})
        self.assertTrue(ok.is_valid(), ok.errors)
        self.assertEqual(ok.validated_data['choices'], ['a', 'b'])
        text = SurveyQuestionSerializer(data={'question': 'Why?', 'question_type': 'text', 'order': 1})
        self.assertTrue(text.is_valid(), text.errors)


class AddQuestionEndpointTests(APITestCase):
    def test_admin_cannot_add_a_choice_question_without_choices(self):
        admin = User.objects.create_user(email='ad2@x.com', password='p', role='lgu_admin', is_active=True)
        s = Survey.objects.create(title='S', created_by=admin)
        self.client.force_authenticate(admin)
        url = f'/api/events/surveys/{s.id}/add-question/'
        bad = self.client.post(url, {'question': 'Pick', 'type': 'multiple_choice', 'choices': []}, format='json')
        self.assertEqual(bad.status_code, 400)
        ok = self.client.post(url, {'question': 'Pick', 'type': 'multiple_choice', 'choices': ['a', 'b']}, format='json')
        self.assertEqual(ok.status_code, 201, ok.data)
        text = self.client.post(url, {'question': 'Why?', 'type': 'text'}, format='json')
        self.assertEqual(text.status_code, 201, text.data)
