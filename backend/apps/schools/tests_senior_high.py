from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient

from .models import School


class SeniorHighSchoolsTests(TestCase):
    def names(self, **params):
        return {s['name'] for s in APIClient().get('/api/schools/', {'page_size': 200, **params}).data['results']}

    def test_the_six_public_and_the_private_senior_high_schools_are_added_once_and_listed_by_level(self):
        call_command('add_senior_high_schools')
        call_command('add_senior_high_schools')  # again: nothing is duplicated
        shs = self.names(level='senior_high')
        self.assertEqual(len(shs), 6 + 25)
        for expected in ('Lucena City National High School', 'Lucena Dalahican National High School', 'Cotta National High School',
                         'Mayao Parada Agricultural Integrated School', 'Sacred Heart College', 'Maryhill College'):
            self.assertIn(expected, shs)
        self.assertEqual(School.objects.count(), 31)
        # a school that only teaches Senior High is not offered under College
        self.assertNotIn('Cotta National High School', self.names(level='college'))

    def test_no_strand_is_claimed_for_a_school_and_every_school_has_its_source(self):
        call_command('add_senior_high_schools')
        for s in School.objects.all():
            self.assertTrue(s.source_url.startswith('https://lucenacity.deped.gov.ph/'), s.name)
            self.assertIn('not confirmed', s.verification_note)
            self.assertEqual(s.school_programs.count(), 0)  # no program is attached without a source for it

    def test_a_college_that_already_exists_is_marked_not_duplicated(self):
        School.objects.create(name='Manuel S. Enverga University Foundation - Lucena', school_type='private', address='Lucena City',
                              municipality='Lucena City', province='Quezon', region='IV-A', offers_college=True)
        call_command('add_senior_high_schools')
        self.assertEqual(School.objects.filter(name__icontains='Enverga').count(), 1)
        mseuf = School.objects.get(name__icontains='Enverga')
        self.assertTrue(mseuf.offers_college and mseuf.offers_senior_high)  # both levels
        self.assertIn(mseuf.name, self.names(level='college'))
        self.assertIn(mseuf.name, self.names(level='senior_high'))
