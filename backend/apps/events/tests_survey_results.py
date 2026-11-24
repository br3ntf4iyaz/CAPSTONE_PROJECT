from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.events.models import Survey


class SurveyResultsAccessTests(APITestCase):
    def setUp(self):
        self.youth = User.objects.create_user(email='y@x.com', password='p', role='youth', is_active=True)
        self.admin = User.objects.create_user(email='a@x.com', password='p', role='lgu_admin', is_active=True)
        self.survey = Survey.objects.create(title='S', is_active=True, created_by=self.admin)

    def test_only_staff_can_see_survey_results(self):
        url = f'/api/events/surveys/{self.survey.id}/analytics/'
        self.assertEqual(self.client.get(url).status_code, 401)
        self.client.force_authenticate(self.youth)
        self.assertEqual(self.client.get(url).status_code, 403)
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.get(url).status_code, 200)
