from rest_framework.test import APITestCase

from apps.accounts.models import User

from .models import Program, School, SchoolProgram


def results(data):
    return data['results'] if isinstance(data, dict) and 'results' in data else data


class SchoolVisibilityTests(APITestCase):
    """Anyone may see every school. The courses a school offers need an account."""

    def setUp(self):
        self.school = School.objects.create(
            name='Manuel S. Enverga University Foundation', school_type='private', description='A university in Lucena.',
            address='Luzonville Subd.', municipality='Lucena City', province='Quezon', region='IV-A')
        self.other = School.objects.create(
            name='Quezon National High School', school_type='public', address='Lucena', municipality='Lucena City', province='Quezon', region='IV-A')
        self.hidden = School.objects.create(
            name='Closed College', school_type='private', address='x', municipality='Lucena City', province='Quezon', region='IV-A', is_active=False)
        self.program = Program.objects.create(name='BS Nursing Unique', program_type='bachelor', field_of_study='health')
        SchoolProgram.objects.create(school=self.school, program=self.program, verification_status='verified', is_active=True)
        SchoolProgram.objects.create(school=self.school, program=Program.objects.create(name='BS Unverified Course', program_type='bachelor'),
                                     verification_status='pending', is_active=True)
        self.user = User.objects.create_user(email='sch@x.com', password='p', role='youth', is_active=True)

    def test_a_visitor_sees_every_active_school_without_signing_in(self):
        r = self.client.get('/api/schools/')
        self.assertEqual(r.status_code, 200)
        names = sorted(s['name'] for s in results(r.data))
        self.assertEqual(names, ['Manuel S. Enverga University Foundation', 'Quezon National High School'])  # not the closed one
        first = next(s for s in results(r.data) if s['name'].startswith('Manuel'))
        self.assertEqual(first['program_count'], 1)  # a teaser: how many, never which

    def test_a_visitor_sees_the_school_but_not_its_courses(self):
        d = self.client.get(f'/api/schools/{self.school.id}/')
        self.assertEqual(d.status_code, 200)
        self.assertEqual(d.data['name'], self.school.name)
        self.assertEqual(d.data['description'], 'A university in Lucena.')
        self.assertEqual(d.data['programs'], [])
        self.assertTrue(d.data['courses_locked'])
        self.assertNotIn('Nursing', str(d.data))

    def test_a_signed_in_user_sees_the_verified_courses(self):
        self.client.force_authenticate(self.user)
        d = self.client.get(f'/api/schools/{self.school.id}/')
        self.assertFalse(d.data['courses_locked'])
        self.assertEqual([p['program']['name'] for p in d.data['programs']], ['BS Nursing Unique'])  # the unverified one is never shown

    def test_the_course_list_and_catalogue_need_an_account(self):
        self.assertEqual(self.client.get('/api/schools/courses/').status_code, 401)
        self.assertEqual(self.client.get('/api/schools/programs/').status_code, 401)
        self.client.force_authenticate(self.user)
        ok = self.client.get('/api/schools/courses/')
        self.assertEqual(ok.status_code, 200)
        self.assertEqual([c['name'] for c in ok.data['results']], ['BS Nursing Unique'])
        self.assertEqual(self.client.get('/api/schools/programs/').status_code, 200)

    def test_a_visitor_cannot_discover_courses_through_search_or_filters(self):
        by_course = self.client.get('/api/schools/', {'search': 'Nursing'})
        self.assertEqual(results(by_course.data), [])  # a course name finds nothing for a visitor
        by_field = self.client.get('/api/schools/', {'field_of_study': 'health'})
        self.assertEqual(len(results(by_field.data)), 2)  # the course filter is ignored, not applied
        by_name = self.client.get('/api/schools/', {'search': 'Enverga'})
        self.assertEqual(len(results(by_name.data)), 1)
        self.client.force_authenticate(self.user)
        self.assertEqual(len(results(self.client.get('/api/schools/', {'search': 'Nursing'}).data)), 1)

    def test_only_a_super_admin_can_change_schools(self):
        self.assertEqual(self.client.post('/api/schools/', {'name': 'x'}, format='json').status_code, 401)
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.post('/api/schools/', {'name': 'x'}, format='json').status_code, 403)
