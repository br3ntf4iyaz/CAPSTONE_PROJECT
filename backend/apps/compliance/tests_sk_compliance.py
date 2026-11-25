import datetime as dt
import shutil
import tempfile
from io import StringIO
from unittest import mock

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.notifications.models import Notification
from apps.sk_requirements.models import SKBarangay, SKRequirement
from apps.verification.models import IDVerification

from . import sk_compliance as sk
from .models import SKComplianceRecord

PDF = b'%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n'
pdf = lambda name='doc.pdf': SimpleUploadedFile(name, PDF, content_type='application/pdf')
NOW = dt.date(2026, 7, 20)  # Q1 and Q2 are past their deadlines, the monthly deadlines up to July 7 have passed


def make_user(email, role='youth', youth_type='general_youth', barangay='', verified=False):
    u = User.objects.create_user(email=email, password='p', role=role, youth_type=youth_type, first_name='T', last_name=email[:3], is_active=True)
    if barangay:
        u.profile.barangay = barangay
        u.profile.save()
    if verified:
        IDVerification.objects.create(user=u, id_type='umid', status='approved')
    return u


class SKComplianceBase(APITestCase):
    def setUp(self):
        self.media = tempfile.mkdtemp()
        self.priv = override_settings(PRIVATE_MEDIA_ROOT=self.media, MEDIA_ROOT=self.media + '/public')
        self.priv.enable()
        self.addCleanup(self.priv.disable)
        self.addCleanup(shutil.rmtree, self.media, True)
        self.a = SKBarangay.objects.create(barangay_name='Barangay A')
        self.b = SKBarangay.objects.create(barangay_name='Barangay B')
        self.admin = make_user('adm@x.com', role='lgu_admin')
        self.sk_a = make_user('ska@x.com', youth_type='sk', barangay='Barangay A', verified=True)
        self.sk_b = make_user('skb@x.com', youth_type='sk', barangay='Barangay B', verified=True)
        self.sk_unverified = make_user('sku@x.com', youth_type='sk', barangay='Barangay A')
        self.general = make_user('gen@x.com')
        self.org = make_user('org@x.com', youth_type='youth_org_leader')
        self.official_deadlines(2026)
        patcher = mock.patch('django.utils.timezone.localdate', return_value=NOW)
        patcher.start()
        self.addCleanup(patcher.stop)
        for p in ('apps.compliance.sk_views.timezone.localdate',):
            pp = mock.patch(p, return_value=NOW)
            pp.start()
            self.addCleanup(pp.stop)

    def official_deadlines(self, year):
        """LYDO configures the deadlines (nothing is assumed): RCB 7th after each quarter, MIL the 7th of the following month."""
        from apps.sk_requirements.models import SKDeadline
        for q, d in enumerate([dt.date(year, 4, 7), dt.date(year, 7, 7), dt.date(year, 10, 7), dt.date(year + 1, 1, 7)], start=1):
            SKDeadline.objects.create(code='quarterly_cash', year=year, quarter=q, deadline=d)
        for m in range(1, 13):
            SKDeadline.objects.create(code='monthly_pr', year=year, month=m, deadline=dt.date(year + (m == 12), (m % 12) + 1, 7))

    def submit(self, user, **kw):
        self.client.force_authenticate(user)
        data = {'category': 'quarterly_cash', 'year': 2026, 'quarter': 1, 'file': pdf(), **kw}
        data = {k: v for k, v in data.items() if v is not None}
        return self.client.post('/api/compliance/sk/records/', data, format='multipart')

    def review(self, rec_id, action, **kw):
        self.client.force_authenticate(self.admin)
        return self.client.post(f'/api/compliance/sk/records/{rec_id}/review/', {'action': action, **kw}, format='json')


class PeriodTests(APITestCase):
    def test_quarterly_and_monthly_periods_and_deadlines(self):
        q = sk.slots_for('quarterly_cash', 2026)
        self.assertEqual([s['deadline'] for s in q], [None] * 4)  # a period has no deadline of its own: only LYDO configures one
        self.assertEqual(q[0]['start'], dt.date(2026, 1, 1))
        self.assertEqual(q[3]['end'], dt.date(2026, 12, 31))
        m = sk.slots_for('monthly_pr', 2026)
        self.assertEqual(len(m), 12)
        self.assertTrue(all(s['deadline'] is None for s in m))
        from apps.sk_requirements.deadlines import deadline_for, load_deadlines
        from apps.sk_requirements.models import SKDeadline
        SKDeadline.objects.create(code='quarterly_cash', year=2026, quarter=1, deadline=dt.date(2026, 4, 7))
        SKDeadline.objects.create(code='monthly_pr', year=2026, month=1, deadline=dt.date(2026, 2, 7))
        SKDeadline.objects.create(code='monthly_pr', year=2026, month=12, deadline=dt.date(2027, 1, 7))
        dl = load_deadlines()  # the official ones LYDO configured
        self.assertEqual(deadline_for(dl, 1, 'quarterly_cash', 2026, 1, None), dt.date(2026, 4, 7))
        self.assertEqual(deadline_for(dl, 1, 'monthly_pr', 2026, None, 1), dt.date(2026, 2, 7))
        self.assertEqual(deadline_for(dl, 1, 'monthly_pr', 2026, None, 12), dt.date(2027, 1, 7))  # December is due January 7 of the next year
        self.assertIsNone(deadline_for(dl, 1, 'monthly_pr', 2025, None, 1))  # no deadline configured for 2025: none is assumed
        self.assertEqual(m[1]['end'], dt.date(2026, 2, 28))
        self.assertEqual(len(sk.slots_for('cbydp', 2026)), 1)


class WorkflowTests(SKComplianceBase):
    def test_submit_review_publish_and_status_transitions(self):
        r = self.submit(self.sk_a)
        self.assertEqual(r.status_code, 201, r.data)
        rid = r.data['id']
        self.assertEqual(r.data['status'], 'submitted')
        self.assertTrue(Notification.objects.filter(user=self.admin, title='New SK compliance submission').exists())
        # returning needs remarks
        self.assertEqual(self.review(rid, 'return').status_code, 400)
        self.assertEqual(self.review(rid, 'start').data['status'], 'under_verification')
        ret = self.review(rid, 'return', remarks='Wrong bank statement')
        self.assertEqual(ret.data['status'], 'returned')
        self.assertTrue(Notification.objects.filter(user=self.sk_a, title='SK compliance document returned').exists())
        # SK sees the remarks, the public never does
        self.client.force_authenticate(self.sk_a)
        slots = self.client.get('/api/compliance/sk/slots/', {'category': 'quarterly_cash', 'year': 2026}).data['slots']
        self.assertEqual(slots[0]['current']['review_remarks'], 'Wrong bank statement')
        # resubmission is a NEW record, the first is kept
        again = self.submit(self.sk_a)
        self.assertEqual(again.status_code, 201)
        self.assertEqual(SKComplianceRecord.objects.filter(barangay=self.a).count(), 2)
        rid2 = again.data['id']
        # cannot publish before verification, and cannot verify the replaced one
        self.assertEqual(self.review(rid2, 'publish').status_code, 409)
        self.assertEqual(self.review(rid, 'verify').status_code, 409)
        self.assertEqual(self.review(rid2, 'verify', remarks='ok').data['status'], 'verified')
        self.assertEqual(self.review(rid2, 'publish', description='Q1 RCB').data['status'], 'published')
        self.assertEqual(self.review(rid2, 'unpublish').data['status'], 'verified')

    def test_completion_needs_verification_not_just_an_upload(self):
        self.submit(self.sk_a)
        self.client.force_authenticate(self.admin)
        o = self.client.get('/api/compliance/sk/overview/', {'year': 2026, 'barangay': self.a.id}).data
        rcb = o['rows'][0]['cells']['quarterly_cash']
        self.assertEqual(rcb['completed'], 0)
        self.assertEqual(rcb['periods'][0]['status'], 'overdue')  # Q1 deadline passed and the upload came after it (test clock): late
        self.assertEqual(o['summary']['completed'], 0)
        self.assertEqual(o['summary']['total'], 10)  # one barangay, ten requirements
        self.assertEqual(rcb['periods'][0]['workflow'], 'submitted')  # it is waiting for LYDO, however late

    def test_overdue_and_summary_numbers_come_from_the_records(self):
        self.client.force_authenticate(self.admin)
        o = self.client.get('/api/compliance/sk/overview/', {'year': 2026}).data
        s = o['summary']
        self.assertEqual(s['total'], 2 * 10)  # 10 requirements x 2 barangays, counted not hardcoded
        self.assertEqual(s['completed'], 0)
        # only the RCB and the MIL have official deadlines, and they have passed: one overdue requirement each, per barangay
        self.assertEqual(s['overdue'], 2 * 2)
        self.assertEqual(s['not_submitted'], 2 * 8)  # everything else is simply Not Yet Submitted, never overdue
        self.assertEqual(s['pending'], 0)  # nothing is a draft
        self.assertEqual(o['percent'], 0)

    def test_filters(self):
        self.client.force_authenticate(self.admin)
        base = {'year': 2026}
        only_rcb = self.client.get('/api/compliance/sk/overview/', {**base, 'category': 'quarterly_cash'}).data
        self.assertEqual(only_rcb['summary']['total'], 2)  # one requirement per barangay
        q1 = self.client.get('/api/compliance/sk/overview/', {**base, 'quarter': 1}).data
        self.assertEqual(q1['rows'][0]['cells']['quarterly_cash']['total'], 1)  # the grid narrows to the first quarter
        overdue = self.client.get('/api/compliance/sk/overview/', {**base, 'status': 'overdue'}).data
        self.assertEqual(overdue['summary']['total'], overdue['summary']['overdue'])
        one = self.client.get('/api/compliance/sk/overview/', {**base, 'barangay': self.a.id}).data
        self.assertEqual([r['barangay'] for r in one['rows']], ['Barangay A'])


class MilTests(SKComplianceBase):
    def test_none_for_the_period_is_a_formal_submission_that_is_verified_and_published(self):
        r = self.submit(self.sk_a, category='monthly_pr', month=3, quarter=None, file=None, none_declaration='true')
        self.assertEqual(r.status_code, 201, r.data)
        self.assertTrue(r.data['is_none_declaration'])
        self.assertEqual(r.data['title'], 'NONE FOR THE PERIOD')
        rec = SKComplianceRecord.objects.get(pk=r.data['id'])
        self.assertEqual((rec.submitted_by, rec.status), (self.sk_a, 'submitted'))
        self.assertIsNotNone(rec.submitted_at)
        # not public until verified and published
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get('/api/compliance/fpdpb/public/').data['items'], [])
        self.review(rec.id, 'verify')
        self.assertEqual(self.client.get('/api/compliance/fpdpb/public/').data['items'], [])
        self.review(rec.id, 'publish')
        self.client.force_authenticate(None)
        items = self.client.get('/api/compliance/fpdpb/public/').data['items']
        self.assertEqual([i['title'] for i in items], ['NONE FOR THE PERIOD'])
        self.assertFalse(items[0]['has_file'])

    def test_a_blank_submission_is_not_a_declaration_and_mixed_ones_are_refused(self):
        r = self.submit(self.sk_a, category='monthly_pr', month=3, quarter=None, file=None)
        self.assertEqual(r.status_code, 400)
        self.assertFalse(SKComplianceRecord.objects.exists())
        both = self.submit(self.sk_a, category='monthly_pr', month=3, quarter=None, none_declaration='true')
        self.assertEqual(both.status_code, 400)
        rcb = self.submit(self.sk_a, category='quarterly_cash', quarter=1, file=None, none_declaration='true')
        self.assertEqual(rcb.status_code, 400)  # only the MIL may declare NONE
        future = self.submit(self.sk_a, category='monthly_pr', month=11, quarter=None)
        self.assertEqual(future.status_code, 400)  # that month has not started yet (test clock is July 2026)

    def test_monthly_document_submission(self):
        r = self.submit(self.sk_a, category='monthly_pr', month=6, quarter=None)
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual((r.data['month'], r.data['quarter']), (6, None))
        dup = self.submit(self.sk_a, category='monthly_pr', month=6, quarter=None)
        self.assertEqual(dup.status_code, 409)


class AuthorizationTests(SKComplianceBase):
    def test_sk_sees_and_submits_only_for_their_own_barangay(self):
        self.client.force_authenticate(self.sk_a)
        o = self.client.get('/api/compliance/sk/overview/', {'year': 2026}).data
        self.assertEqual([r['barangay'] for r in o['rows']], ['Barangay A'])
        # asking for another barangay does not widen the view
        self.assertEqual(self.client.get('/api/compliance/sk/overview/', {'year': 2026, 'barangay': self.b.id}).status_code, 403)
        self.assertEqual(self.client.get('/api/compliance/sk/overview/', {'year': 2026, 'barangay': self.a.id}).status_code, 200)
        s = self.client.get('/api/compliance/sk/slots/', {'category': 'quarterly_cash', 'year': 2026, 'barangay': self.b.id})
        self.assertEqual(s.status_code, 403)
        # a submission always lands in the SK's own barangay, even if another is named
        r = self.submit(self.sk_a, barangay=self.b.id)
        self.assertEqual(SKComplianceRecord.objects.get(pk=r.data['id']).barangay, self.a)
        # SK cannot review
        self.assertEqual(self.review_as(self.sk_a, r.data['id']).status_code, 403)
        self.client.force_authenticate(self.sk_a)
        self.assertEqual(self.client.get('/api/compliance/sk/queue/').status_code, 403)

    def review_as(self, user, rid):
        self.client.force_authenticate(user)
        return self.client.post(f'/api/compliance/sk/records/{rid}/review/', {'action': 'verify'}, format='json')

    def test_other_barangays_cannot_open_a_file(self):
        rid = self.submit(self.sk_a).data['id']
        for user, code in ((self.sk_a, 200), (self.admin, 200), (self.sk_b, 404), (self.general, 404), (self.org, 404)):
            self.client.force_authenticate(user)
            self.assertEqual(self.client.get(f'/api/compliance/sk/records/{rid}/file/').status_code, code, user.email)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(f'/api/compliance/sk/records/{rid}/file/').status_code, 401)

    def test_general_youth_org_leaders_and_unverified_sk_cannot_submit(self):
        self.assertEqual(self.submit(self.general).status_code, 403)
        self.assertEqual(self.submit(self.org).status_code, 403)
        r = self.submit(self.sk_unverified)
        self.assertEqual(r.status_code, 403)
        self.assertEqual(r.data['code'], 'verify_first')
        self.client.force_authenticate(self.general)
        self.assertEqual(self.client.get('/api/compliance/sk/overview/').status_code, 403)
        self.assertEqual(self.client.get('/api/compliance/sk/queue/').status_code, 403)
        self.assertFalse(SKComplianceRecord.objects.exists())


class PublicDisclosureTests(SKComplianceBase):
    def setUp(self):
        super().setUp()
        self.rid = self.submit(self.sk_a).data['id']

    def public(self, **params):
        self.client.force_authenticate(None)
        return self.client.get('/api/compliance/fpdpb/public/', params).data['items']

    def test_only_published_documents_are_visible_or_downloadable(self):
        self.client.force_authenticate(None)
        for stage in (None, 'start', 'verify'):
            if stage:
                self.review(self.rid, stage)
            self.client.force_authenticate(None)
            self.assertEqual(self.public(), [], stage)
            self.assertEqual(self.client.get(f'/api/compliance/fpdpb/files/{self.rid}/').status_code, 404, stage)
        self.review(self.rid, 'publish', description='Public note')
        items = self.public()
        self.assertEqual(len(items), 1)
        self.assertNotIn('review_remarks', items[0])
        self.assertNotIn('submitted_by', items[0])
        ok = self.client.get(f'/api/compliance/fpdpb/files/{self.rid}/')
        self.assertEqual(ok.status_code, 200)
        self.assertEqual(b''.join(ok.streaming_content)[:4], b'%PDF')
        dl = self.client.get(f'/api/compliance/fpdpb/files/{self.rid}/', {'download': 1})
        self.assertIn('attachment', dl['Content-Disposition'])
        # unpublishing removes it again
        self.review(self.rid, 'unpublish')
        self.assertEqual(self.public(), [])
        self.assertEqual(self.client.get(f'/api/compliance/fpdpb/files/{self.rid}/').status_code, 404)

    def test_returned_documents_and_remarks_stay_private(self):
        self.review(self.rid, 'return', remarks='INTERNAL: figures do not match')
        self.assertEqual(self.public(), [])
        self.assertEqual(self.client.get(f'/api/compliance/fpdpb/files/{self.rid}/').status_code, 404)

    def test_public_filters(self):
        self.review(self.rid, 'verify')
        self.review(self.rid, 'publish')
        other = self.submit(self.sk_b, category='monthly_pr', month=2, quarter=None).data['id']
        self.review(other, 'verify')
        self.review(other, 'publish')
        self.assertEqual(len(self.public()), 2)
        self.assertEqual([i['barangay'] for i in self.public(barangay=self.a.id)], ['Barangay A'])
        self.assertEqual([i['category'] for i in self.public(category='monthly_pr')], ['monthly_pr'])
        self.assertEqual(len(self.public(year=2026, quarter=1)), 1)
        self.assertEqual(len(self.public(month=2)), 1)
        self.assertEqual(self.public(year=2020), [])


class ExistingModulesTests(SKComplianceBase):
    """CBYDP, ABYIP and the Annual Budget are the EXISTING SK Requirements: referenced, never duplicated."""

    def setUp(self):
        super().setUp()
        self.req = SKRequirement.objects.create(barangay=self.a, requirement_type='cbydp')
        self.client.force_authenticate(self.sk_a)

    def upload_existing(self, req=None):
        self.client.force_authenticate(self.sk_a)
        return self.client.post(f'/api/sk-requirements/requirements/{(req or self.req).id}/upload/', {'file': pdf('cbydp.pdf')}, format='multipart')

    def test_existing_upload_is_indexed_without_copying_or_duplicating(self):
        self.assertEqual(self.upload_existing().status_code, 200)
        self.assertEqual(SKComplianceRecord.objects.count(), 1)
        rec = SKComplianceRecord.objects.get()
        self.assertEqual((rec.requirement, rec.category, rec.status), (self.req, 'cbydp', 'submitted'))
        self.assertFalse(rec.file)  # nothing was copied: the record points at the stored file
        self.req.refresh_from_db()
        self.assertEqual(rec.source_file_name, self.req.file.name)
        # reading the dashboards does not create more records
        self.client.force_authenticate(self.admin)
        for _ in range(3):
            self.client.get('/api/compliance/sk/overview/', {'year': 2026})
        self.assertEqual(SKComplianceRecord.objects.count(), 1)
        self.assertEqual(SKRequirement.objects.count(), 1)

    def test_old_uploads_made_before_the_system_existed_are_picked_up_once(self):
        old = SKRequirement.objects.create(barangay=self.b, requirement_type='abyip', status='submitted', submitted_at=timezone.now())
        old.file.save('old-abyip.pdf', pdf(), save=True)
        self.assertFalse(SKComplianceRecord.objects.filter(requirement=old).exists())
        self.client.force_authenticate(self.admin)
        o = self.client.get('/api/compliance/sk/overview/', {'year': timezone.now().year}).data
        self.assertEqual(SKComplianceRecord.objects.filter(requirement=old).count(), 1)
        self.client.get('/api/compliance/sk/overview/', {'year': timezone.now().year})
        self.assertEqual(SKComplianceRecord.objects.filter(requirement=old).count(), 1)
        cell = next(r for r in o['rows'] if r['barangay'] == 'Barangay B')['cells']['abyip']
        self.assertIn(cell['periods'][0]['workflow'], ('submitted', None))

    def test_the_verified_file_stays_the_published_file_when_the_sk_uploads_a_newer_one(self):
        self.upload_existing()
        rec1 = SKComplianceRecord.objects.get()
        self.review(rec1.id, 'verify')
        self.review(rec1.id, 'publish')
        first_name = rec1.source_file_name
        # the SK replaces the file through the existing page: a new record to verify, the published one stays public and unchanged
        self.client.force_authenticate(self.sk_a)
        self.client.post(f'/api/sk-requirements/requirements/{self.req.id}/upload/', {'file': pdf('cbydp-v2.pdf')}, format='multipart')
        self.assertEqual(SKComplianceRecord.objects.count(), 2)
        rec1.refresh_from_db()
        self.assertEqual((rec1.status, rec1.source_file_name), ('published', first_name))
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(f'/api/compliance/fpdpb/files/{rec1.id}/').status_code, 200)
        self.assertEqual(len(self.client.get('/api/compliance/fpdpb/public/').data['items']), 1)

    def test_abyip_shows_existing_ppas_and_cbydp_links_to_the_existing_module(self):
        from apps.programs.models import ProgramSubmission
        ProgramSubmission.objects.create(
            submitter_type='sk', submitted_by=self.sk_a, title='Youth Sports Fest', barangay='Barangay A', submission_type='ppa',
            status='approved', abyip_reference_code='ABYIP-2026-001', estimated_budget=15000, category='education')
        self.client.force_authenticate(self.sk_a)
        d = self.client.get('/api/compliance/sk/slots/', {'category': 'abyip', 'year': 2026}).data
        self.assertEqual([p['abyip_reference_code'] for p in d['ppas']], ['ABYIP-2026-001'])
        self.assertEqual(d['ppa_budget_total'], '15000.00')
        c = self.client.get('/api/compliance/sk/slots/', {'category': 'cbydp', 'year': 2026}).data
        self.assertEqual(c['manage_url'], '/sk-requirements')
        self.assertEqual(c['requirement']['id'], self.req.id)

    def test_new_categories_cannot_be_created_for_the_existing_modules(self):
        r = self.submit(self.sk_a, category='cbydp')
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data['code'], 'use_existing')

    def test_public_sk_directory_only_links_published_documents(self):
        self.upload_existing()
        self.client.force_authenticate(None)
        data = self.client.get('/api/sk-requirements/barangays/').data
        results = data['results'] if isinstance(data, dict) else data
        entry = next(b for b in results if b['id'] == self.a.id)
        for r in entry.get('requirements', []):
            self.assertIsNone(r['file_url'])
        rec = SKComplianceRecord.objects.get()
        self.review(rec.id, 'verify')
        self.review(rec.id, 'publish')
        self.client.force_authenticate(None)
        data = self.client.get(f'/api/sk-requirements/barangays/{self.a.id}/').data
        urls = [r['file_url'] for r in data.get('requirements', []) if r['key'] == 'cbydp']
        self.assertTrue(urls and urls[0].endswith(f'/api/compliance/fpdpb/files/{rec.id}/'))


class RemindersTests(SKComplianceBase):
    def test_reminders_go_to_the_right_people_and_are_not_repeated(self):
        out = StringIO()
        call_command('send_compliance_reminders', stdout=out)
        # Barangay A has overdue documents: its SK officials are told, the other barangay's are told separately
        self.assertTrue(Notification.objects.filter(user=self.sk_a, title='SK compliance documents are overdue').exists())
        self.assertFalse(Notification.objects.filter(user=self.general).exists())
        self.assertTrue(Notification.objects.filter(user=self.admin, title='SK compliance summary').exists())
        before = Notification.objects.count()
        call_command('send_compliance_reminders', stdout=out)
        self.assertEqual(Notification.objects.count(), before)  # no duplicates
