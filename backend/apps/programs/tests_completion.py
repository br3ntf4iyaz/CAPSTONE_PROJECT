import tempfile

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import ProgramSubmission

User = get_user_model()
MEDIA = tempfile.mkdtemp()
NARRATIVE = 'We completed the clean-up drive with strong youth turnout and lasting impact on the river. ' * 2


def pdf():
    return SimpleUploadedFile('report.pdf', b'%PDF-1.4 ' + b'x' * 100, content_type='application/pdf')


@override_settings(MEDIA_ROOT=MEDIA)
class CompletionAmountSpentTests(TestCase):
    def setUp(self):
        self.sk = User.objects.create_user(email='sk@x.com', password='p', first_name='S', last_name='K', youth_type='sk')
        self.other = User.objects.create_user(email='o@x.com', password='p', first_name='O', last_name='T')
        self.api = APIClient()

    def submission(self, kind='ppa', **extra):
        return ProgramSubmission.objects.create(
            submitted_by=self.sk, submitter_type='sk', title='Clean-up Drive', submission_type=kind,
            status='in_progress', estimated_budget='15000.00', **extra)

    def complete(self, sub, user=None, **fields):
        self.api.force_authenticate(user or self.sk)
        data = {'actual_participants': 120, 'outcomes_narrative': NARRATIVE, 'completion_report_file': pdf(), **fields}
        return self.api.post(f'/api/programs/submissions/{sub.pk}/submit-completion/', data, format='multipart')

    def test_ppa_report_without_amount_spent_is_refused(self):
        sub = self.submission()
        r = self.complete(sub)
        self.assertEqual(r.status_code, 400)
        self.assertIn('actual_disbursement', r.data)
        sub.refresh_from_db()
        self.assertEqual(sub.status, 'in_progress')

    def test_ppa_report_with_amount_spent_is_saved(self):
        sub = self.submission()
        r = self.complete(sub, actual_disbursement='13250.50')
        self.assertEqual(r.status_code, 200, r.data)
        sub.refresh_from_db()
        self.assertEqual((sub.status, str(sub.actual_participants), str(sub.actual_disbursement)),
                         ('completion_submitted', '120', '13250.50'))

    def test_negative_amount_is_refused(self):
        sub = self.submission()
        self.assertEqual(self.complete(sub, actual_disbursement='-5').status_code, 400)

    def test_zero_is_a_valid_amount_for_a_free_activity(self):
        sub = self.submission()
        self.assertEqual(self.complete(sub, actual_disbursement='0').status_code, 200)

    def test_policy_submissions_do_not_need_an_amount(self):
        sub = self.submission(kind='policy')
        self.assertEqual(self.complete(sub).status_code, 200)

    def test_an_amount_entered_earlier_is_kept_when_resubmitting_without_one(self):
        sub = self.submission(actual_disbursement='9000.00')
        self.assertEqual(self.complete(sub).status_code, 200)
        sub.refresh_from_db()
        self.assertEqual(str(sub.actual_disbursement), '9000.00')

    def test_only_the_submitter_can_file_the_report(self):
        sub = self.submission()
        # Other users cannot even see it (404), which is stricter than a 403.
        self.assertIn(self.complete(sub, user=self.other, actual_disbursement='1').status_code, (403, 404))
        sub.refresh_from_db()
        self.assertEqual(sub.status, 'in_progress')
