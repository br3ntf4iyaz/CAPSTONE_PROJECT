import datetime as dt
import io
import shutil
import tempfile

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.compliance.models import SKComplianceRecord
from apps.notifications.models import Notification

from .models import SKBarangay, SKDeadline, SKRequirement, SKRequirementConfig

User = get_user_model()
TMP = tempfile.mkdtemp()
THIS_YEAR = timezone.localdate().year


def pdf(name='doc.pdf'):
    return SimpleUploadedFile(name, b'%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF', content_type='application/pdf')


@override_settings(MEDIA_ROOT=TMP, PRIVATE_MEDIA_ROOT=TMP)
class LaunchReadyTests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TMP, ignore_errors=True)

    def setUp(self):
        self.brgys = [SKBarangay.objects.create(barangay_name=f'Barangay {n}') for n in (1, 2, 3)]
        self.admin = User.objects.create_user(email='ad@t.local', password='x', role='lgu_admin', is_active=True)
        self.sk1 = self.make_sk('sk1@t.local', 'Barangay 1')
        self.sk2 = self.make_sk('sk2@t.local', 'Barangay 2')
        self.ac, self.c1, self.c2, self.anon = APIClient(), APIClient(), APIClient(), APIClient()
        self.ac.force_authenticate(self.admin)
        self.c1.force_authenticate(self.sk1)
        self.c2.force_authenticate(self.sk2)

    def make_sk(self, email, barangay):
        u = User.objects.create_user(email=email, password='x', role='youth', youth_type='sk', is_active=True)
        u.profile.barangay = barangay
        u.profile.save()
        return u

    def mine(self, client=None):
        return (client or self.c1).get('/api/sk-requirements/requirements/mine/').data

    def item(self, code, client=None):
        return next(i for i in self.mine(client)['requirements'] if i['type'] == code)

    def overview(self, **params):
        return self.ac.get('/api/compliance/sk/overview/', {'year': THIS_YEAR, **params}).data

    def upload(self, code, client=None, **data):
        rid = self.item(code, client)['id']
        return (client or self.c1).post(f'/api/sk-requirements/requirements/{rid}/upload/', data, format='multipart')

    # TEST 1, 7, 8: the clean starting point
    def test_a_new_sk_sees_ten_requirements_all_not_yet_submitted_with_no_overdue(self):
        m = self.mine()
        self.assertEqual(len(m['requirements']), 10)
        self.assertTrue(all(i['status'] == 'not_submitted' for i in m['requirements']))
        self.assertTrue(all(i['due_date'] is None for i in m['requirements']))  # no deadline is made up
        self.assertTrue(all(i['instructions'] and i['description'] for i in m['requirements']))  # every requirement has its own guidance
        self.assertEqual(len({i['instructions'] for i in m['requirements']}), 10)  # not one generic text
        self.assertEqual(m['summary'], {'completed': 0, 'awaiting': 0, 'returned': 0, 'overdue': 0, 'total': 10, 'drafts': 0, 'not_submitted': 10})

    def test_the_admin_numbers_start_at_zero_and_the_total_is_counted_not_hardcoded(self):
        s = self.overview()['summary']
        self.assertEqual(s['total'], 3 * 10)  # three barangays here: 30, and 330 for the real 33
        for key in ('completed', 'pending', 'overdue', 'for_verification', 'returned', 'verified', 'published'):
            self.assertEqual(s[key], 0, key)
        self.assertEqual(s['not_submitted'], 30)
        SKRequirementConfig.objects.filter(code='annex_h').update(is_active=False)  # LYDO switches one requirement off
        self.assertEqual(self.overview()['summary']['total'], 3 * 9)
        self.assertEqual(self.overview()['percent'], 0)

    def test_a_requirement_can_apply_to_selected_barangays_only(self):
        cfg = SKRequirementConfig.objects.get(code='minutes')
        self.ac.patch(f'/api/sk-requirements/config/{cfg.pk}/', {'applies_to_all': False, 'barangays': [self.brgys[0].pk]}, format='json')
        self.assertIn('minutes', [i['type'] for i in self.mine(self.c1)['requirements']])
        self.assertNotIn('minutes', [i['type'] for i in self.mine(self.c2)['requirements']])
        self.assertEqual(self.overview()['summary']['total'], 10 + 9 + 9)

    # TEST 8, 9: overdue only with an official deadline
    def test_overdue_needs_an_official_deadline_that_has_passed_and_applies_to_the_barangay(self):
        self.assertEqual(self.item('annex_h')['status'], 'not_submitted')
        r = self.ac.post('/api/sk-requirements/deadlines/', {'code': 'annex_h', 'year': THIS_YEAR, 'deadline': '2020-01-31',
                                                              'applies_to_all': False, 'barangays': [self.brgys[0].pk]}, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(self.item('annex_h', self.c1)['status'], 'overdue')  # applies to Barangay 1, and it has passed
        self.assertEqual(self.item('annex_h', self.c2)['status'], 'not_submitted')  # not to Barangay 2
        self.assertEqual(self.overview()['summary']['overdue'], 1)
        SKDeadline.objects.update(is_active=False)
        self.assertEqual(self.item('annex_h', self.c1)['status'], 'not_submitted')  # an inactive deadline counts for nothing
        SKDeadline.objects.update(is_active=True, deadline=dt.date(THIS_YEAR + 1, 12, 31))
        self.assertEqual(self.item('annex_h', self.c1)['status'], 'not_submitted')  # not passed yet
        self.assertEqual(str(self.item('annex_h', self.c1)['due_date']), str(dt.date(THIS_YEAR + 1, 12, 31)))

    def test_an_overdue_requirement_stops_being_overdue_once_it_is_waiting_or_verified(self):
        SKDeadline.objects.create(code='policies', year=THIS_YEAR, deadline=dt.date(2020, 1, 1))
        self.assertEqual(self.item('policies')['status'], 'overdue')
        self.assertEqual(self.upload('policies', file=pdf()).status_code, 200)
        self.assertEqual(self.item('policies')['status'], 'submitted')

    def test_deadline_rules_are_validated_and_only_lydo_manages_them(self):
        bad = [{'code': 'quarterly_cash', 'year': THIS_YEAR, 'deadline': '2026-04-07'}, {'code': 'monthly_pr', 'year': THIS_YEAR, 'quarter': 1, 'deadline': '2026-04-07'},
               {'code': 'annex_h', 'year': THIS_YEAR, 'month': 3, 'deadline': '2026-04-07'}, {'code': 'annex_h', 'year': THIS_YEAR, 'deadline': '2026-04-07', 'applies_to_all': False, 'barangays': []}]
        for body in bad:
            self.assertEqual(self.ac.post('/api/sk-requirements/deadlines/', body, format='json').status_code, 400, body)
        ok = {'code': 'quarterly_cash', 'year': THIS_YEAR, 'quarter': 2, 'deadline': '2026-07-07'}
        self.assertEqual(self.ac.post('/api/sk-requirements/deadlines/', ok, format='json').status_code, 201)
        for client in (self.c1, self.anon):
            self.assertIn(client.post('/api/sk-requirements/deadlines/', ok, format='json').status_code, (401, 403))
            self.assertIn(client.get('/api/sk-requirements/config/').status_code, (401, 403))

    # configurable guidance
    def test_lydo_can_edit_the_guidance_and_the_sk_sees_it(self):
        cfg = SKRequirementConfig.objects.get(code='annex_h')
        r = self.ac.patch(f'/api/sk-requirements/config/{cfg.pk}/', {'instructions': 'Upload the signed Annex H. Include the page with all signatures.'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertIn('all signatures', self.item('annex_h')['instructions'])
        self.assertEqual(self.c1.patch(f'/api/sk-requirements/config/{cfg.pk}/', {'instructions': 'hack'}, format='json').status_code, 403)

    # drafts
    def test_a_draft_is_saved_edited_and_deleted_and_never_counts(self):
        rid = self.item('minutes')['id']
        url = f'/api/sk-requirements/requirements/{rid}/upload/'
        self.assertEqual(self.c1.post(url, {'action': 'draft'}, format='multipart').status_code, 400)  # nothing to save
        self.assertEqual(self.c1.post(url, {'action': 'draft', 'file': pdf('m.pdf'), 'period_year': THIS_YEAR, 'period_label': 'March meeting', 'remarks': 'not final'}, format='multipart').status_code, 200)
        it = self.item('minutes')
        self.assertEqual((it['status'], it['period_label'], it['sk_remarks'], it['has_file']), ('draft', 'March meeting', 'not final', True))
        self.assertEqual(self.mine()['summary']['drafts'], 1)
        self.assertEqual(self.overview()['summary']['pending'], 1)  # the draft is the only "pending" item, and it is not completed
        self.assertEqual(self.overview()['summary']['completed'], 0)
        self.assertFalse(Notification.objects.filter(user=self.admin, title='New SK document submitted').exists())  # nothing was sent to LYDO
        self.assertEqual(self.c1.post(url, {'action': 'draft', 'period_label': 'March and April meetings'}, format='multipart').status_code, 200)  # edit
        self.assertEqual(self.item('minutes')['period_label'], 'March and April meetings')
        self.assertEqual(self.c2.post(f'/api/sk-requirements/requirements/{rid}/discard-draft/').status_code, 404)  # not another barangay's
        self.assertEqual(self.c1.post(f'/api/sk-requirements/requirements/{rid}/discard-draft/').status_code, 200)
        it = self.item('minutes')
        self.assertEqual((it['status'], it['has_file']), ('not_submitted', False))

    def test_a_draft_can_be_submitted_without_choosing_the_file_again(self):
        rid = self.item('policies')['id']
        url = f'/api/sk-requirements/requirements/{rid}/upload/'
        self.c1.post(url, {'action': 'draft', 'file': pdf('p.pdf')}, format='multipart')
        self.assertEqual(self.c1.post(url, {'action': 'submit', 'period_year': THIS_YEAR}, format='multipart').status_code, 200)
        self.assertEqual(self.item('policies')['status'], 'submitted')
        self.assertTrue(Notification.objects.filter(user=self.admin, title='New SK document submitted').exists())
        self.assertEqual(self.c1.post(f'/api/sk-requirements/requirements/{rid}/discard-draft/').status_code, 400)  # no longer a draft

    def test_the_submission_form_validates_the_file(self):
        rid = self.item('policies')['id']
        url = f'/api/sk-requirements/requirements/{rid}/upload/'
        exe = SimpleUploadedFile('x.exe', b'MZ', content_type='application/octet-stream')
        self.assertEqual(self.c1.post(url, {'file': exe}, format='multipart').status_code, 400)
        self.assertEqual(self.c1.post(url, {'period_year': 1999, 'file': pdf()}, format='multipart').status_code, 400)
        docx = SimpleUploadedFile('p.docx', b'PK\x03\x04' + b'\x00' * 40, content_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document')
        self.assertIn(self.c1.post(url, {'file': docx}, format='multipart').status_code, (200, 400))  # office files are accepted by type, content is checked

    # TEST 2 to 6: the whole path with the Annual Budget Plan
    def test_annual_budget_from_submission_to_the_public_fpdpb(self):
        up = self.upload('annual_budget', file=pdf('budget.pdf'), remarks='Budget 2026', period_year=THIS_YEAR)
        self.assertEqual(up.status_code, 200, up.data)
        self.assertEqual(self.item('annual_budget')['status'], 'submitted')
        rec = SKComplianceRecord.objects.get(barangay=self.brgys[0], category='annual_budget')
        self.assertEqual((rec.status, rec.submitted_by), ('submitted', self.sk1))
        queue = self.ac.get('/api/compliance/sk/queue/').data['to_verify']
        self.assertEqual([(q['barangay'], q['category']) for q in queue], [('Barangay 1', 'annual_budget')])
        self.assertEqual(self.anon.get('/api/compliance/fpdpb/public/').data['items'], [])  # nothing public yet
        review = lambda action, **kw: self.ac.post(f'/api/compliance/sk/records/{rec.id}/review/', {'action': action, **kw}, format='json')
        self.assertEqual(review('return', remarks='').status_code, 400)
        self.assertEqual(review('return', remarks='The budget total does not match the ABYIP.').status_code, 200)
        self.assertEqual(self.item('annual_budget')['status'], 'returned')
        self.assertTrue(Notification.objects.filter(user=self.sk1).exists())
        again = self.c1.post(f"/api/sk-requirements/requirements/{self.item('annual_budget')['id']}/upload/", {'file': pdf('budget-v2.pdf')}, format='multipart')
        self.assertEqual(again.status_code, 200, again.data)
        self.assertEqual(SKComplianceRecord.objects.filter(barangay=self.brgys[0], category='annual_budget').count(), 2)  # the first one is kept as history
        rec2 = SKComplianceRecord.objects.filter(barangay=self.brgys[0], category='annual_budget').order_by('-id').first()
        self.assertEqual(self.ac.post(f'/api/compliance/sk/records/{rec2.id}/review/', {'action': 'verify', 'remarks': 'Correct'}, format='json').status_code, 200)
        self.assertEqual(self.item('annual_budget')['status'], 'verified')
        s = self.overview()['summary']
        self.assertEqual((s['completed'], s['verified'], s['published']), (1, 1, 0))
        self.assertEqual(self.anon.get('/api/compliance/fpdpb/public/').data['items'], [])  # verified is still not public
        self.assertEqual(self.ac.post(f'/api/compliance/sk/records/{rec2.id}/review/', {'action': 'publish', 'description': 'Annual Budget 2026'}, format='json').status_code, 200)
        self.assertEqual(len(self.anon.get('/api/compliance/fpdpb/public/').data['items']), 1)
        s = self.overview()['summary']
        self.assertEqual((s['completed'], s['verified'], s['published']), (1, 0, 1))
        self.assertEqual(self.overview()['percent'], round(100 * 1 / 30))

    # TEST 10
    def test_another_barangays_submission_is_not_reachable(self):
        self.upload('annex_h', file=pdf())
        rid = self.item('annex_h')['id']
        self.assertEqual(self.c2.get(f'/api/sk-requirements/requirements/{rid}/file/').status_code, 404)
        self.assertEqual(self.c2.post(f'/api/sk-requirements/requirements/{rid}/upload/', {'file': pdf()}, format='multipart').status_code, 404)
        self.assertEqual(self.item('annex_h', self.c2)['status'], 'not_submitted')

    # cleanup
    def test_the_cleanup_resets_demo_overdue_and_dates_and_keeps_real_submissions(self):
        demo, _ = SKRequirement.objects.get_or_create(barangay=self.brgys[1], requirement_type='policies')
        demo.status, demo.due_date, demo.submitted_at = 'overdue', dt.date(2020, 1, 1), timezone.now()
        demo.save()
        self.upload('annex_h', file=pdf())
        real = SKRequirement.objects.get(barangay=self.brgys[0], requirement_type='annex_h')
        out = io.StringIO()
        call_command('reset_sk_placeholders', stdout=out)
        self.assertIn('Nothing changed', out.getvalue())
        demo.refresh_from_db()
        self.assertEqual(demo.status, 'overdue')  # a dry run changes nothing
        call_command('reset_sk_placeholders', '--yes', stdout=io.StringIO())
        demo.refresh_from_db()
        self.assertEqual((demo.status, demo.due_date, demo.submitted_at), ('pending', None, None))
        real.refresh_from_db()
        self.assertEqual(real.status, 'submitted')
        self.assertTrue(real.file)
        self.assertEqual(self.item('policies', self.c2)['status'], 'not_submitted')
