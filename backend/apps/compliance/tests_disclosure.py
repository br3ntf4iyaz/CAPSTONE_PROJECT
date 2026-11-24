import datetime as dt
import shutil
import tempfile
from unittest import mock

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import User

from . import disclosure
from .models import DisclosureRequirement, DisclosureSubmission

PDF = b'%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n'


def pdf(name='report.pdf'):
    return SimpleUploadedFile(name, PDF, content_type='application/pdf')


class DisclosurePeriodTests(APITestCase):
    def test_quarterly_deadlines_follow_the_office_schedule(self):
        self.assertEqual(disclosure.quarter_deadline(2026, 1), dt.date(2026, 4, 7))
        self.assertEqual(disclosure.quarter_deadline(2026, 2), dt.date(2026, 7, 7))
        self.assertEqual(disclosure.quarter_deadline(2026, 3), dt.date(2026, 10, 7))
        self.assertEqual(disclosure.quarter_deadline(2026, 4), dt.date(2027, 1, 7))  # Q4 is due in the NEXT year

    def test_a_quarterly_requirement_generates_four_periods_and_an_annual_one_generates_one(self):
        quarterly = DisclosureRequirement(title='q', frequency='quarterly')
        periods = disclosure.periods_for(quarterly, 2026)
        self.assertEqual([p['quarter'] for p in periods], [1, 2, 3, 4])
        self.assertEqual(periods[0]['start'], dt.date(2026, 1, 1))
        self.assertEqual(periods[3]['end'], dt.date(2026, 12, 31))
        annual = DisclosureRequirement(title='a', frequency='annual', deadline_month=2, deadline_day=30)
        (only,) = disclosure.periods_for(annual, 2026)
        self.assertEqual(only['deadline'], dt.date(2026, 2, 28))  # a day that does not exist is moved to the last day
        none = DisclosureRequirement(title='n', frequency='annual')
        self.assertIsNone(disclosure.periods_for(none, 2026)[0]['deadline'])

    def test_status_rules(self):
        deadline = dt.date(2026, 4, 7)
        S = lambda status, day: mock.Mock(status=status, uploaded_at=timezone.make_aware(dt.datetime(2026, *day, 10, 0)))
        today_before, today_after = dt.date(2026, 3, 1), dt.date(2026, 4, 8)
        self.assertEqual(disclosure.period_status([], deadline, today_before), ('pending', False))
        self.assertEqual(disclosure.period_status([], deadline, dt.date(2026, 4, 7)), ('pending', False))  # due today is not overdue yet
        self.assertEqual(disclosure.period_status([], deadline, today_after), ('overdue', False))
        # an upload alone never completes a period
        self.assertEqual(disclosure.period_status([S('uploaded', (4, 1))], deadline, today_before), ('under_review', False))
        self.assertEqual(disclosure.period_status([S('uploaded', (4, 1))], deadline, today_after), ('under_review', False))
        # a late upload that is still waiting is overdue
        self.assertEqual(disclosure.period_status([S('uploaded', (4, 9))], deadline, today_after), ('overdue', True))
        # a rejected upload does not count
        self.assertEqual(disclosure.period_status([S('rejected', (4, 1))], deadline, today_after), ('overdue', False))
        # only verification completes it, even when late
        self.assertEqual(disclosure.period_status([S('verified', (4, 20))], deadline, today_after), ('completed', False))


class DisclosureApiTests(APITestCase):
    def setUp(self):
        self.media = tempfile.mkdtemp()
        self.override = override_settings(PRIVATE_MEDIA_ROOT=self.media)
        self.override.enable()
        self.addCleanup(self.override.disable)
        self.addCleanup(shutil.rmtree, self.media, True)
        self.admin = User.objects.create_user(email='da@x.com', password='p', role='lgu_admin', is_active=True)
        self.youth = User.objects.create_user(email='dy@x.com', password='p', role='youth', is_active=True)
        self.req = DisclosureRequirement.objects.filter(frequency='quarterly').first()  # created by the migration

    def upload(self, **kw):
        data = {'requirement': self.req.id, 'year': 2026, 'quarter': 1, 'file': pdf(), **kw}
        return self.client.post('/api/compliance/disclosure/submissions/', data, format='multipart')

    def test_the_quarterly_financial_report_exists_from_the_start(self):
        self.assertIsNotNone(self.req)
        self.assertEqual(self.req.title, 'Quarterly Financial Transaction Report')

    def test_administrators_only(self):
        for method, url in (('get', '/api/compliance/disclosure/overview/'), ('get', '/api/compliance/disclosure/requirements/')):
            self.assertEqual(getattr(self.client, method)(url).status_code, 401)
        self.client.force_authenticate(self.youth)
        self.assertEqual(self.client.get('/api/compliance/disclosure/overview/').status_code, 403)
        self.assertEqual(self.upload().status_code, 403)
        self.assertEqual(self.client.post('/api/compliance/disclosure/requirements/', {'title': 'x'}, format='json').status_code, 403)
        self.assertFalse(DisclosureSubmission.objects.exists())

    def test_overview_summary_and_nothing_is_completed_by_generating_periods(self):
        self.client.force_authenticate(self.admin)
        with mock.patch('apps.compliance.disclosure_views.timezone.localdate', return_value=dt.date(2026, 7, 20)):
            o = self.client.get('/api/compliance/disclosure/overview/', {'year': 2026}).data
        s = o['summary']
        self.assertEqual((s['total'], s['completed'], s['pending'], s['overdue']), (4, 0, 2, 2))  # Q1 and Q2 are overdue
        statuses = [p['status'] for p in o['requirements'][0]['periods']]
        self.assertEqual(statuses, ['overdue', 'overdue', 'pending', 'pending'])

    def test_upload_then_verify_completes_and_history_is_kept(self):
        self.client.force_authenticate(self.admin)
        r = self.upload()
        self.assertEqual(r.status_code, 201, r.data)
        sub_id = r.data['id']
        # the test clock says early March 2026, so the upload happened then (before the April 7 deadline)
        DisclosureSubmission.objects.filter(pk=sub_id).update(uploaded_at=timezone.make_aware(dt.datetime(2026, 2, 20, 9, 0)))
        with mock.patch('apps.compliance.disclosure_views.timezone.localdate', return_value=dt.date(2026, 3, 1)):
            o = self.client.get('/api/compliance/disclosure/overview/', {'year': 2026}).data
        q1 = o['requirements'][0]['periods'][0]
        self.assertEqual(q1['status'], 'under_review')  # uploaded is not completed
        self.assertEqual(o['summary']['completed'], 0)
        v = self.client.post(f'/api/compliance/disclosure/submissions/{sub_id}/verify/', {}, format='json')
        self.assertEqual(v.status_code, 200)
        self.assertEqual(v.data['status'], 'verified')
        # a corrected file is a NEW record: the first one stays in the history
        self.assertEqual(self.upload(file=pdf('corrected.pdf')).status_code, 201)
        with mock.patch('apps.compliance.disclosure_views.timezone.localdate', return_value=dt.date(2026, 3, 1)):
            o = self.client.get('/api/compliance/disclosure/overview/', {'year': 2026}).data
        q1 = o['requirements'][0]['periods'][0]
        self.assertEqual(q1['status'], 'completed')
        self.assertEqual(len(q1['history']), 2)
        self.assertEqual(o['summary']['completed'], 1)

    def test_rejecting_needs_a_reason_and_does_not_complete(self):
        self.client.force_authenticate(self.admin)
        sub_id = self.upload().data['id']
        self.assertEqual(self.client.post(f'/api/compliance/disclosure/submissions/{sub_id}/reject/', {}, format='json').status_code, 400)
        r = self.client.post(f'/api/compliance/disclosure/submissions/{sub_id}/reject/', {'note': 'Wrong quarter'}, format='json')
        self.assertEqual(r.data['status'], 'rejected')
        with mock.patch('apps.compliance.disclosure_views.timezone.localdate', return_value=dt.date(2026, 5, 1)):
            q1 = self.client.get('/api/compliance/disclosure/overview/', {'year': 2026}).data['requirements'][0]['periods'][0]
        self.assertEqual(q1['status'], 'overdue')

    def test_upload_validation(self):
        self.client.force_authenticate(self.admin)
        fake = SimpleUploadedFile('fake.pdf', b'not really a pdf', content_type='application/pdf')
        self.assertEqual(self.upload(file=fake).status_code, 400)
        exe = SimpleUploadedFile('run.exe', b'MZ....', content_type='application/octet-stream')
        self.assertEqual(self.upload(file=exe).status_code, 400)
        self.assertEqual(self.client.post('/api/compliance/disclosure/submissions/', {
            'requirement': self.req.id, 'year': 2026, 'file': pdf()}, format='multipart').status_code, 400)  # quarter missing
        self.assertFalse(DisclosureSubmission.objects.exists())

    def test_public_sees_only_verified_public_documents_and_can_download_them(self):
        self.client.force_authenticate(self.admin)
        verified = self.upload(title='Q1 report').data['id']
        waiting = self.upload(quarter=2, title='Q2 report').data['id']
        hidden = self.upload(quarter=3, title='Q3 report').data['id']
        self.client.post(f'/api/compliance/disclosure/submissions/{verified}/verify/', {}, format='json')
        self.client.post(f'/api/compliance/disclosure/submissions/{hidden}/verify/', {'is_public': False}, format='json')
        self.client.force_authenticate(None)  # a visitor, no sign-in
        data = self.client.get('/api/compliance/disclosure/public/').data
        self.assertEqual([i['title'] for i in data['items']], ['Q1 report'])
        ok = self.client.get(f'/api/compliance/disclosure/files/{verified}/')
        self.assertEqual(ok.status_code, 200)
        self.assertEqual(b''.join(ok.streaming_content)[:4], b'%PDF')
        self.assertEqual(self.client.get(f'/api/compliance/disclosure/files/{waiting}/').status_code, 404)
        self.assertEqual(self.client.get(f'/api/compliance/disclosure/files/{hidden}/').status_code, 404)
        self.client.force_authenticate(self.youth)
        self.assertEqual(self.client.get(f'/api/compliance/disclosure/files/{waiting}/').status_code, 404)
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.get(f'/api/compliance/disclosure/files/{waiting}/').status_code, 200)

    def test_deleting_a_requirement_only_switches_it_off(self):
        self.client.force_authenticate(self.admin)
        sub = self.upload().data['id']
        self.assertEqual(self.client.delete(f'/api/compliance/disclosure/requirements/{self.req.id}/').status_code, 204)
        self.req.refresh_from_db()
        self.assertFalse(self.req.is_active)
        self.assertTrue(DisclosureSubmission.objects.filter(pk=sub).exists())
