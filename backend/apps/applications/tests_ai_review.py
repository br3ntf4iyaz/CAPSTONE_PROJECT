import json
from unittest import mock

from django.core.cache import cache
from django.test import override_settings

from apps.accounts.models import AuditLog
from apps.notifications.models import Notification

from . import ai_screening
from .models import OpportunityApplication
from .tests_job_apply import TMP, pdf
from .tests_scholarship import png

from rest_framework.test import APITestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from apps.accounts.models import User
from apps.jobs.models import JobOpportunity
from apps.verification.models import IDVerification

FACE_OK = {'distance': 0.3, 'similarity': 0.7, 'matched': True, 'front': {'uploaded': False}, 'back': {'uploaded': False}, 'selfie': {'uploaded': False}}


def model_answer(resume='verified', selfie='needs_review'):
    return json.dumps({
        'id_front': {'status': 'verified', 'detected_type': 'UMID', 'finding': 'It appears to be a government-issued ID and is readable.',
                     'name': 'Juan Dela Cruz', 'id_number': '1234'},
        'id_back': {'status': 'verified', 'detected_type': 'UMID back', 'finding': 'The back of an ID, readable.'},
        'selfie': {'status': selfie, 'detected_type': 'portrait', 'finding': 'A portrait. Identity cannot be confirmed automatically.'},
        'resume': {'status': resume, 'detected_type': 'resume' if resume == 'verified' else 'photograph',
                   'finding': 'It is a resume.' if resume == 'verified' else 'The uploaded file appears to be an ordinary photograph rather than a resume or CV.',
                   'sections_found': ['education', 'skills']},
        'requirements': [{'requirement': 'Education graduate', 'status': 'needs_confirmation', 'finding': 'Education listed; confirm the diploma.'}],
    })


@override_settings(PRIVATE_MEDIA_ROOT=TMP, MEDIA_ROOT=TMP, ANTHROPIC_API_KEY='test-key', AI_SCREENING_NO_WAIT=True)
class AIReviewTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(email='a@x.com', password='p', role='youth', is_active=True, first_name='Juan', last_name='Dela Cruz')
        self.stranger = User.objects.create_user(email='s@x.com', password='p', role='youth', is_active=True)
        self.admin = User.objects.create_user(email='ad@x.com', password='p', role='lgu_admin', is_active=True)
        for u in (self.user, self.stranger):
            IDVerification.objects.create(user=u, id_type='umid', status='approved')
        self.job = JobOpportunity.objects.create(title='Teacher', company_or_org='DepEd', location='Lucena', job_type='full_time', industry='other',
                                                 description='Teach', requirements='Education graduate', is_active=True)

    def apply(self):
        self.client.force_authenticate(self.user)
        r = self.client.post('/api/applications/', {
            'kind': 'job', 'object_id': self.job.id, 'full_name': 'Juan Dela Cruz', 'contact_number': '0917', 'email': 'a@x.com', 'address': 'Lucena',
            'id_type': 'UMID', 'id_number': '1234', 'id_document': png('front.png'), 'id_document_back': png('back.png'), 'selfie': png('selfie.png'),
            'document': pdf('cv.pdf'), 'face_check': json.dumps(FACE_OK)}, format='multipart')
        self.assertEqual(r.status_code, 201, r.data)
        return r.data['id']

    def screen(self, app_id, answer=None, error=None):
        with mock.patch.object(ai_screening, '_call_model', side_effect=error) if error else mock.patch.object(ai_screening, '_call_model', return_value=answer):
            ai_screening.run_screening(app_id)
        return OpportunityApplication.objects.get(pk=app_id)

    def open_all(self, app_id):
        self.client.force_authenticate(self.admin)
        for part in ('id-document', 'id-document-back', 'selfie', 'document'):
            self.assertEqual(self.client.get(f'/api/applications/{app_id}/{part}/').status_code, 200)

    def tick_all(self, app_id):
        r = self.client.post(f'/api/applications/{app_id}/manual-checks/', {'checks': {'id': True, 'selfie': True, 'resume': True, 'ai_findings': True}}, format='json')
        self.assertEqual(r.status_code, 200, r.data)

    def review(self, app_id):
        self.client.force_authenticate(self.admin)
        self.client.patch(f'/api/applications/{app_id}/', {'status': 'under_review'}, format='json')

    # TEST 1
    def test_valid_documents_are_screened_then_the_administrator_reviews_and_approves(self):
        app_id = self.apply()
        # saved first; the AI has not run yet and the applicant did not wait for it
        self.assertEqual(OpportunityApplication.objects.get(pk=app_id).ai_status, 'pending')
        app = self.screen(app_id, model_answer())
        self.assertEqual(app.ai_status, 'done')
        self.assertEqual(app.ai_results['documents']['resume']['status'], 'ai_verified')
        self.assertEqual(app.ai_results['documents']['selfie']['status'], 'needs_review')  # a portrait is never "verified"
        self.assertEqual(app.status, 'submitted')  # the AI never decides
        self.review(app_id)
        self.open_all(app_id)
        self.tick_all(app_id)
        r = self.client.patch(f'/api/applications/{app_id}/', {'status': 'approved', 'admin_note': 'Welcome'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertTrue(Notification.objects.filter(user=self.user, title='Application approved').exists())
        for action in ('application_submitted', 'application_ai_started', 'application_ai_completed', 'application_requirement_opened',
                       'application_manual_check', 'application_approved'):
            self.assertTrue(AuditLog.objects.filter(action=action, object_id=app_id).exists(), action)
        log = AuditLog.objects.get(action='application_approved', object_id=app_id)
        self.assertEqual(log.details['from'], 'under_review')
        self.assertEqual(log.details['to'], 'approved')
        self.assertEqual(log.details['administrator_id'], self.admin.pk)

    # TEST 2
    def test_a_photograph_instead_of_a_resume_is_flagged_and_can_be_refused_with_a_reason(self):
        app_id = self.apply()
        app = self.screen(app_id, model_answer(resume='invalid'))
        self.assertEqual(app.ai_results['documents']['resume']['status'], 'invalid')
        self.assertIn('photograph', app.ai_results['documents']['resume']['finding'])
        self.assertIn('Resume', app.ai_results['overall'])
        self.review(app_id)
        self.open_all(app_id)
        self.tick_all(app_id)
        # even with everything opened and ticked, an invalid requirement blocks approval
        r = self.client.patch(f'/api/applications/{app_id}/', {'status': 'approved'}, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertTrue(any('Resume' in b for b in r.data['blockers']))
        r = self.client.patch(f'/api/applications/{app_id}/', {'status': 'rejected', 'rejected_items': ['resume'], 'admin_note': ''}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertIn('Resume requirement is invalid or missing', r.data['admin_note'])
        n = Notification.objects.get(user=self.user, title='Application not accepted')
        self.assertIn('Please submit the correct document', n.message)

    # TEST 3
    def test_opening_every_document_does_not_make_an_application_approvable(self):
        app_id = self.apply()
        self.screen(app_id, model_answer())
        self.review(app_id)
        self.open_all(app_id)
        app = OpportunityApplication.objects.get(pk=app_id)
        self.assertEqual(set(app.opened_docs), {'id_front', 'id_back', 'selfie', 'resume'})
        self.assertEqual(app.manual_checks, {})  # nothing was ticked for the administrator
        r = self.client.patch(f'/api/applications/{app_id}/', {'status': 'approved'}, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertTrue(any('Tick' in b for b in r.data['blockers']))

    def test_a_box_cannot_be_ticked_for_a_file_that_was_not_opened(self):
        app_id = self.apply()
        self.screen(app_id, model_answer())
        self.review(app_id)
        r = self.client.post(f'/api/applications/{app_id}/manual-checks/', {'checks': {'resume': True}}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_approval_waits_while_the_ai_is_still_running(self):
        app_id = self.apply()  # still pending
        self.review(app_id)
        self.open_all(app_id)
        r = self.client.post(f'/api/applications/{app_id}/manual-checks/', {'checks': {'ai_findings': True}}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_an_administrator_may_approve_despite_an_ai_flag_only_with_a_written_reason(self):
        app_id = self.apply()
        self.screen(app_id, model_answer(resume='invalid'))
        self.review(app_id)
        self.open_all(app_id)
        self.tick_all(app_id)
        self.assertEqual(self.client.patch(f'/api/applications/{app_id}/', {'status': 'approved', 'ai_override_note': 'short'}, format='json').status_code, 400)
        r = self.client.patch(f'/api/applications/{app_id}/', {'status': 'approved', 'ai_override_note': 'The file is a scanned resume, the AI misread it.'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)

    # TEST 4
    def test_not_accepted_works_without_opening_anything_and_needs_a_reason(self):
        app_id = self.apply()
        self.client.force_authenticate(self.admin)
        url = f'/api/applications/{app_id}/'
        self.assertEqual(self.client.patch(url, {'status': 'rejected'}, format='json').status_code, 400)  # no reason at all
        r = self.client.patch(url, {'status': 'rejected', 'rejected_items': ['id_front', 'resume'], 'admin_note': 'The ID is blurry.'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertIn('ID front, Resume', r.data['admin_note'])
        self.assertIn('The ID is blurry.', r.data['admin_note'])

    # TEST 5
    def test_when_the_ai_is_down_the_application_is_still_saved_and_manual_review_stays_possible(self):
        app_id = self.apply()
        app = self.screen(app_id, error=ai_screening.Transient('timeout'))
        self.assertEqual(app.ai_status, 'failed')
        self.assertEqual(app.ai_results['documents']['resume']['status'], 'failed')  # never silently "verified"
        self.assertTrue(AuditLog.objects.filter(action='application_ai_failed', object_id=app_id).exists())
        self.review(app_id)
        self.open_all(app_id)
        self.tick_all(app_id)
        r = self.client.patch(f'/api/applications/{app_id}/', {'status': 'approved'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)

    @override_settings(ANTHROPIC_API_KEY='')
    def test_without_an_ai_key_it_says_unavailable(self):
        app_id = self.apply()
        with mock.patch.dict('os.environ', {'GROQ_API_KEY': ''}):
            app = self.screen(app_id, model_answer())
        self.assertEqual(app.ai_status, 'unavailable')
        self.assertEqual(app.ai_results['documents']['id_front']['status'], 'unavailable')

    def test_a_garbled_ai_answer_is_a_failure_not_a_success(self):
        app = self.screen(self.apply(), 'sorry I cannot help')
        self.assertEqual(app.ai_status, 'failed')

    def test_the_ai_cannot_invent_a_status_and_a_different_id_number_is_flagged(self):
        answer = json.loads(model_answer())
        answer['id_front']['id_number'] = '9999'
        answer['resume']['status'] = 'definitely_great'
        app = self.screen(self.apply(), json.dumps(answer))
        self.assertEqual(app.ai_results['documents']['id_front']['status'], 'needs_review')
        self.assertIn('differs', app.ai_results['documents']['id_front']['finding'])
        self.assertEqual(app.ai_results['documents']['resume']['status'], 'needs_review')

    # TEST 6
    def test_an_approval_can_be_revoked_with_a_reason_and_the_history_is_kept(self):
        app_id = self.apply()
        self.screen(app_id, model_answer())
        self.review(app_id)
        self.open_all(app_id)
        self.tick_all(app_id)
        self.client.patch(f'/api/applications/{app_id}/', {'status': 'approved', 'admin_note': 'Approved'}, format='json')
        url = f'/api/applications/{app_id}/revoke/'
        self.assertEqual(self.client.post(url, {'reason': 'The ID was found to be fake'}, format='json').status_code, 400)  # no confirmation
        self.assertEqual(self.client.post(url, {'confirm': True, 'reason': 'fake'}, format='json').status_code, 400)  # reason too short
        r = self.client.post(url, {'confirm': True, 'reason': 'The ID was found to be fake'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        app = OpportunityApplication.objects.get(pk=app_id)
        self.assertEqual(app.status, 'revoked')
        self.assertEqual(app.revoked_by, self.admin)
        self.assertIsNotNone(app.revoked_at)
        self.assertIsNotNone(app.approved_at)  # the approval record is preserved
        log = AuditLog.objects.get(action='application_revoked', object_id=app_id)
        self.assertEqual(log.details['previous_approval']['approved_by'], self.admin.pk)
        self.assertTrue(Notification.objects.filter(user=self.user, title='Application approval revoked').exists())
        self.assertEqual(self.client.post(url, {'confirm': True, 'reason': 'again and again'}, format='json').status_code, 400)  # no longer approved

    # TEST 7
    def test_unauthorised_people_cannot_decide_revoke_or_tick(self):
        app_id = self.apply()
        for who in (self.user, self.stranger, None):
            self.client.force_authenticate(who)
            for method, url, body in (('patch', f'/api/applications/{app_id}/', {'status': 'rejected', 'admin_note': 'no way'}),
                                      ('post', f'/api/applications/{app_id}/revoke/', {'confirm': True, 'reason': 'not allowed at all'}),
                                      ('post', f'/api/applications/{app_id}/manual-checks/', {'checks': {'id': True}}),
                                      ('post', f'/api/applications/{app_id}/rescreen/', {})):
                self.assertIn(getattr(self.client, method)(url, body, format='json').status_code, (401, 403, 404), (who, url))
        self.assertEqual(OpportunityApplication.objects.get(pk=app_id).status, 'submitted')

    def test_applicant_opening_their_own_file_is_not_counted_as_an_admin_review(self):
        app_id = self.apply()
        self.client.get(f'/api/applications/{app_id}/document/')
        self.assertEqual(OpportunityApplication.objects.get(pk=app_id).opened_docs, {})

    # TEST 8
    def test_the_applicant_sees_the_reason_but_never_the_ai_findings_or_admin_working(self):
        app_id = self.apply()
        self.screen(app_id, model_answer(resume='invalid'))
        self.client.force_authenticate(self.admin)
        self.client.patch(f'/api/applications/{app_id}/', {'status': 'rejected', 'rejected_items': ['resume']}, format='json')
        self.client.force_authenticate(self.user)
        data = self.client.get(f'/api/applications/{app_id}/').data
        self.assertIn('Resume', data['admin_note'])
        for hidden in ('ai_status', 'ai_results', 'manual_checks', 'opened_docs', 'ai_override_note', 'approval_blockers', 'revocation_reason', 'face_check'):
            self.assertNotIn(hidden, data, hidden)
        self.assertNotIn('photograph', json.dumps(data))
        listing = self.client.get('/api/applications/').data
        self.assertNotIn('ai_results', json.dumps(listing))

    def test_resubmitting_starts_a_fresh_screening_and_review(self):
        app_id = self.apply()
        self.screen(app_id, model_answer(resume='invalid'))
        self.review(app_id)
        # (files are not opened here: Windows keeps opened files locked, which only matters in this test)
        self.client.patch(f'/api/applications/{app_id}/', {'status': 'rejected', 'rejected_items': ['resume']}, format='json')
        self.client.force_authenticate(self.user)
        r = self.client.post(f'/api/applications/{app_id}/resubmit/', {
            'full_name': 'Juan Dela Cruz', 'contact_number': '0917', 'email': 'a@x.com', 'address': 'Lucena', 'id_type': 'UMID', 'id_number': '1234',
            'id_document': png('f.png'), 'id_document_back': png('b.png'), 'selfie': png('s.png'), 'document': pdf('cv2.pdf'),
            'face_check': json.dumps(FACE_OK)}, format='multipart')
        self.assertEqual(r.status_code, 200, r.data)
        app = OpportunityApplication.objects.get(pk=app_id)
        self.assertEqual((app.ai_status, app.opened_docs, app.manual_checks, app.ai_results), ('pending', {}, {}, {}))

    def test_a_legacy_application_without_files_cannot_be_approved_but_can_be_refused(self):
        app_id = self.apply()
        OpportunityApplication.objects.filter(pk=app_id).update(id_document='', id_document_back='', selfie='')
        self.review(app_id)
        r = self.client.patch(f'/api/applications/{app_id}/', {'status': 'approved'}, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertTrue(any('was not submitted' in b for b in r.data['blockers']))
        self.assertEqual(self.client.patch(f'/api/applications/{app_id}/', {'status': 'rejected', 'rejected_items': ['id_front']}, format='json').status_code, 200)

    def test_a_corrupted_resume_is_found_without_calling_the_ai_for_it(self):
        app_id = self.apply()
        OpportunityApplication.objects.filter(pk=app_id).update(document='')
        app = OpportunityApplication.objects.get(pk=app_id)
        app.document.save('cv.pdf', SimpleUploadedFile('cv.pdf', b'not a pdf at all'), save=True)
        out = self.screen(app_id, json.dumps({k: v for k, v in json.loads(model_answer()).items() if k != 'resume'}))
        self.assertEqual(out.ai_results['documents']['resume']['status'], 'invalid')

    @override_settings(ANTHROPIC_API_KEY='')
    def test_the_free_service_is_chosen_when_only_its_key_exists(self):
        with mock.patch.dict('os.environ', {'GROQ_API_KEY': 'gsk-test'}):
            self.assertEqual(ai_screening.provider(), 'groq')
            # a PDF with no readable text is left for the administrator, never called valid or invalid
            app_id = self.apply()
            answer = json.dumps({k: v for k, v in json.loads(model_answer()).items() if k != 'resume'})
            app = self.screen(app_id, answer)
        self.assertEqual(app.ai_results['documents']['resume']['status'], 'needs_review')
        self.assertEqual(app.ai_status, 'done')
