from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from .models import ComplianceRecord

User = get_user_model()


class ParticipationRecordTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(email='adm@x.com', password='p', first_name='Ad', last_name='Min', role='lgu_admin')
        self.juan = User.objects.create_user(email='juan@x.com', password='p', first_name='Juan', last_name='Cruz')
        self.ana = User.objects.create_user(email='ana@x.com', password='p', first_name='Ana', last_name='Reyes')
        self.api = APIClient()

    def record(self, by=None, **data):
        self.api.force_authenticate(by or self.admin)
        payload = {'user': self.juan.pk, 'record_type': 'governance_participation',
                   'value': 1, 'description': 'Attended the Barangay 3 council meeting (2026-11-10)', **data}
        return self.api.post('/api/compliance/records/', payload, format='json')

    def test_admin_records_attendance_at_a_council_meeting(self):
        r = self.record()
        self.assertEqual(r.status_code, 201, r.data)
        rec = ComplianceRecord.objects.get()
        self.assertEqual((rec.user_id, rec.record_type, rec.recorded_by_id), (self.juan.pk, 'governance_participation', self.admin.pk))
        self.assertEqual(r.data['record_type_display'], 'Governance Participation')
        self.assertEqual(r.data['user_name'], 'Juan Cruz')

    def test_youth_cannot_create_edit_or_delete_records(self):
        self.assertEqual(self.record(by=self.juan).status_code, 403)
        self.record()
        rec = ComplianceRecord.objects.get()
        self.api.force_authenticate(self.juan)
        self.assertEqual(self.api.patch(f'/api/compliance/records/{rec.pk}/', {'value': 50}, format='json').status_code, 403)
        self.assertEqual(self.api.delete(f'/api/compliance/records/{rec.pk}/').status_code, 403)
        self.assertEqual(ComplianceRecord.objects.count(), 1)

    def test_youth_see_only_their_own_records(self):
        self.record()
        self.record(**{'user': self.ana.pk, 'description': 'Joined the clean-up'})
        self.api.force_authenticate(self.juan)
        rows = self.api.get('/api/compliance/records/').data
        rows = rows['results'] if isinstance(rows, dict) else rows
        self.assertEqual([x['user'] for x in rows], [self.juan.pk])

    def test_admin_can_filter_by_type_and_user(self):
        self.record()
        self.record(**{'user': self.ana.pk, 'record_type': 'event_attendance', 'description': 'Youth Summit'})
        self.api.force_authenticate(self.admin)

        def ids(params):
            d = self.api.get('/api/compliance/records/', params).data
            return {x['user'] for x in (d['results'] if isinstance(d, dict) else d)}

        self.assertEqual(ids({'record_type': 'event_attendance'}), {self.ana.pk})
        self.assertEqual(ids({'user_id': self.juan.pk}), {self.juan.pk})
        self.assertEqual(ids({}), {self.juan.pk, self.ana.pk})

    def test_invalid_type_and_markup_are_handled(self):
        self.assertEqual(self.record(record_type='bogus').status_code, 400)
        r = self.record(description='<script>alert(1)</script>Attended')
        self.assertEqual(r.status_code, 201)
        self.assertNotIn('<script>', r.data['description'])

    def test_admin_can_delete_a_mistaken_record(self):
        self.record()
        rec = ComplianceRecord.objects.get()
        self.api.force_authenticate(self.admin)
        self.assertEqual(self.api.delete(f'/api/compliance/records/{rec.pk}/').status_code, 204)
        self.assertEqual(ComplianceRecord.objects.count(), 0)

    def test_admin_user_search_finds_youth_for_the_picker(self):
        self.api.force_authenticate(self.admin)
        d = self.api.get('/api/auth/admin/users/', {'search': 'ana', 'role': 'youth'}).data
        rows = d['results'] if isinstance(d, dict) else d
        self.assertEqual([x['email'] for x in rows], ['ana@x.com'])
