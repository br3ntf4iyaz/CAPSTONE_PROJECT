from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import AuditLog
from apps.notifications.models import Notification
from apps.verification.models import IDVerification

from .models import OrgMembershipApplication, YouthOrganization

User = get_user_model()


class MembershipFlowTests(TestCase):
    def setUp(self):
        self.leader = User.objects.create_user(email='leader@t.local', password='x', role='youth', youth_type='youth_org_leader', is_active=True)
        self.admin = User.objects.create_user(email='ad@t.local', password='x', role='lgu_admin', is_active=True)
        self.person = User.objects.create_user(email='p@t.local', password='x', role='youth', is_active=True)
        self.org = YouthOrganization.objects.create(name='Public Org', classification='community_based', sub_classification='youth_org',
                                                    barangay='Ilayang Talim', is_active=True, status='approved', submitted_by=self.leader)
        self.url = f'/api/youth-orgs/{self.org.pk}/apply/'
        self.decide = f'/api/youth-orgs/{self.org.pk}/decide-application/'
        self.pc, self.lc, self.ac = APIClient(), APIClient(), APIClient()
        self.pc.force_authenticate(self.person)
        self.lc.force_authenticate(self.leader)
        self.ac.force_authenticate(self.admin)

    def verify(self, user=None, status='approved'):
        IDVerification.objects.update_or_create(user=user or self.person, defaults={'status': status})

    def apply(self, **extra):
        return self.pc.post(self.url, {'message': 'I want to help', 'consent': 'true', **extra}, format='json')

    # an unverified account cannot apply, and is told why
    def test_only_a_verified_account_can_apply(self):
        for status in (None, 'pending', 'reviewing', 'rejected', 'revision', 'suspended'):
            if status:
                self.verify(status=status)
            r = self.apply()
            self.assertEqual(r.status_code, 403, status)
            self.assertEqual(r.data['code'], 'verify_first')
        self.assertFalse(OrgMembershipApplication.objects.exists())

    def test_the_privacy_agreement_is_required(self):
        self.verify()
        self.assertEqual(self.pc.post(self.url, {'message': 'x'}, format='json').status_code, 400)
        self.assertFalse(OrgMembershipApplication.objects.exists())

    def test_apply_keeps_a_reference_snapshot_and_history_and_tells_people(self):
        self.verify()
        r = self.apply()
        self.assertEqual(r.status_code, 201)
        self.assertTrue(r.data['reference_number'].startswith('LYD-M-'))
        self.assertEqual(r.data['status'], 'pending')
        self.assertEqual(r.data['snapshot']['email'], 'p@t.local')
        self.assertEqual([e['action'] for e in r.data['history']], ['submitted'])
        self.assertTrue(Notification.objects.filter(user=self.leader, title='New membership application').exists())
        self.assertTrue(AuditLog.objects.filter(action='org_membership_applied').exists())
        self.assertEqual(self.apply().status_code, 400)  # only one at a time

    def test_the_leader_does_not_see_the_phone_number_but_lydo_does(self):
        self.verify()
        self.person.profile.phone = '+63 917 123 4567'
        self.person.profile.save()
        self.apply()
        lead = self.lc.get(f'/api/youth-orgs/{self.org.pk}/applications/').data[0]
        adm = self.ac.get('/api/youth-orgs/membership-applications/').data[0]
        self.assertNotIn('phone', lead['snapshot'])
        self.assertEqual(adm['snapshot']['phone'], '+63 917 123 4567')

    def test_revision_then_resubmission_keeps_the_whole_history(self):
        self.verify()
        app_id = self.apply().data['id']
        self.assertEqual(self.ac.post(self.decide, {'application': app_id, 'status': 'revision'}, format='json').status_code, 400)  # a note is needed
        self.assertEqual(self.ac.post(self.decide, {'application': app_id, 'status': 'revision', 'note': 'Please add your school'}, format='json').status_code, 200)
        self.assertTrue(Notification.objects.filter(user=self.person, title='Application needs a correction').exists())
        r = self.apply(message='Added my school')
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data['status'], 'pending')
        self.assertEqual(OrgMembershipApplication.objects.count(), 1)
        self.assertEqual([e['action'] for e in r.data['history']], ['submitted', 'revision_requested', 'resubmitted'])

    def test_approve_reject_and_the_rules_about_who_can_do_what(self):
        self.verify()
        app_id = self.apply().data['id']
        self.assertEqual(self.pc.post(self.decide, {'application': app_id, 'status': 'accepted'}, format='json').status_code, 403)  # the applicant cannot
        self.assertEqual(self.ac.post(self.decide, {'application': app_id, 'status': 'reviewing'}, format='json').status_code, 200)
        self.assertEqual(self.ac.post(self.decide, {'application': app_id, 'status': 'accepted'}, format='json').status_code, 200)
        self.assertEqual(self.ac.post(self.decide, {'application': app_id, 'status': 'declined', 'note': 'late reason'}, format='json').status_code, 400)  # already decided
        self.assertTrue(Notification.objects.filter(user=self.person, title='Membership approved').exists())

    def test_a_person_who_lost_verification_cannot_be_approved(self):
        self.verify()
        app_id = self.apply().data['id']
        self.verify(status='suspended')
        r = self.ac.post(self.decide, {'application': app_id, 'status': 'accepted'}, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertEqual(OrgMembershipApplication.objects.get(pk=app_id).status, 'pending')

    def test_revoking_is_for_lydo_needs_a_reason_and_keeps_history(self):
        self.verify()
        app_id = self.apply().data['id']
        self.ac.post(self.decide, {'application': app_id, 'status': 'accepted'}, format='json')
        self.assertEqual(self.lc.post(self.decide, {'application': app_id, 'status': 'revoked', 'note': 'Not active anymore'}, format='json').status_code, 403)
        self.assertEqual(self.ac.post(self.decide, {'application': app_id, 'status': 'revoked'}, format='json').status_code, 400)
        r = self.ac.post(self.decide, {'application': app_id, 'status': 'revoked', 'note': 'Not active anymore'}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['status'], 'revoked')
        self.assertEqual([e['action'] for e in r.data['history']], ['submitted', 'approved', 'revoked'])
        self.assertTrue(AuditLog.objects.filter(action='org_membership_decided', details__decision='revoked').exists())
        self.assertEqual(self.apply().status_code, 400)  # a revoked member cannot just apply again

    def test_a_rejected_person_may_apply_again(self):
        self.verify()
        app_id = self.apply().data['id']
        self.ac.post(self.decide, {'application': app_id, 'status': 'declined', 'note': 'Not eligible yet'}, format='json')
        r = self.apply()
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data['status'], 'pending')

    def test_the_lydo_list_is_for_lydo_only(self):
        self.verify()
        self.apply()
        self.assertEqual(self.pc.get('/api/youth-orgs/membership-applications/').status_code, 403)
        self.assertEqual(self.lc.get('/api/youth-orgs/membership-applications/').status_code, 403)
        self.assertEqual(len(self.ac.get('/api/youth-orgs/membership-applications/').data), 1)
        self.assertEqual(len(self.ac.get('/api/youth-orgs/membership-applications/?status=accepted').data), 0)

    def test_the_person_can_correct_their_details_when_sending_again(self):
        self.verify()
        app_id = self.apply().data['id']
        self.ac.post(self.decide, {'application': app_id, 'status': 'revision', 'note': 'Please add your school'}, format='json')
        r = self.apply(contact_phone='0917 123 4567', barangay='Ilayang Talim', school='Lucena City College')
        self.assertEqual(r.status_code, 201)
        snap = OrgMembershipApplication.objects.get(pk=app_id).snapshot
        self.assertEqual((snap['phone'], snap['barangay'], snap['school']), ('0917 123 4567', 'Ilayang Talim', 'Lucena City College'))
        self.assertEqual(snap['email'], 'p@t.local')  # the name and email always come from the account
        self.ac.post(self.decide, {'application': app_id, 'status': 'revision', 'note': 'Fix the number'}, format='json')
        self.assertEqual(self.apply(contact_phone='call me <b>').status_code, 400)

    def test_lydo_can_delete_only_a_rejected_application_and_it_is_logged(self):
        self.verify()
        app_id = self.apply().data['id']
        url = f'/api/youth-orgs/{self.org.pk}/delete-application/'
        self.assertEqual(self.ac.post(url, {'application': app_id}, format='json').status_code, 400)  # not rejected yet
        self.ac.post(self.decide, {'application': app_id, 'status': 'declined', 'note': 'Not eligible yet'}, format='json')
        self.assertEqual(self.lc.post(url, {'application': app_id}, format='json').status_code, 403)
        self.assertEqual(self.pc.post(url, {'application': app_id}, format='json').status_code, 403)
        self.assertEqual(self.ac.post(url, {'application': app_id}, format='json').status_code, 204)
        self.assertFalse(OrgMembershipApplication.objects.exists())
        self.assertTrue(AuditLog.objects.filter(action='org_membership_deleted').exists())
        self.assertEqual(self.apply().status_code, 201)  # the person may apply again

    def test_an_impossible_birthdate_holds_the_application_and_a_real_one_gives_the_age(self):
        from datetime import date, timedelta
        self.verify()
        self.person.profile.birthdate = date.today() - timedelta(days=10)  # born ten days ago: cannot be right
        self.person.profile.save()
        r = self.apply()
        self.assertEqual((r.status_code, r.data['code']), (400, 'birthdate_invalid'))
        self.assertFalse(OrgMembershipApplication.objects.exists())
        self.person.profile.birthdate = date(date.today().year - 20, 1, 1)
        self.person.profile.save()
        r = self.apply()
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data['snapshot']['age'], 20)

    def test_no_birthdate_at_all_is_allowed_and_shown_as_not_set(self):
        self.verify()
        r = self.apply()
        self.assertEqual(r.status_code, 201)
        self.assertIsNone(r.data['snapshot']['age'])
