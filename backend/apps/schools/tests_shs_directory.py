from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient

from .models import School, SchoolOffering

User = get_user_model()


def make_school(**kw):
    base = dict(school_type='private', address='Lucena City, Quezon', municipality='Lucena City', province='Quezon', region='IV-A')
    base.update(kw)
    return School.objects.create(**base)


class ShsDirectoryTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email='y@example.com', password='x-Pass-12345')
        self.admin = User.objects.create_user(email='a@example.com', password='x-Pass-12345', role='super_admin')

    def names(self, client=None, **params):
        r = (client or APIClient()).get('/api/schools/', {'page_size': 200, 'level': 'senior_high', **params})
        return {s['name'] for s in r.data['results']}

    def test_the_classification_filters(self):
        call_command('add_senior_high_schools')
        call_command('update_shs_directory')
        public = self.names(sector='public')
        self.assertIn('Quezon National High School (QNHS)', public)
        self.assertIn('Cotta National High School', public)
        self.assertNotIn('Sacred Heart College', public)
        private = self.names(sector='private')
        self.assertTrue(any('Sacred Heart' in n for n in private))
        self.assertNotIn('Cotta National High School', private)
        # the SUC filter lists SLSU Lucena with its note, as it is a college / TESDA campus
        suc = self.names(sector='suc')
        slsu = [n for n in suc if 'Southern Luzon' in n]
        self.assertEqual(len(slsu), 1)
        self.assertFalse(School.objects.get(name=slsu[0]).offers_senior_high)
        self.assertIn('Lucban', School.objects.get(name=slsu[0]).shs_note)
        # and not as a Senior High provider anywhere else
        self.assertNotIn(slsu[0], self.names(sector='public'))

    def test_techvoc_public_and_private_are_separate(self):
        call_command('update_shs_directory')
        pub = self.names(techvoc=1, sector='public')
        self.assertEqual(len(pub), 5)
        self.assertIn('Gulang-Gulang National High School', pub)
        priv = self.names(techvoc=1, sector='private')
        self.assertEqual(len(priv), 10)
        self.assertTrue(any('STI College' in n for n in priv))
        self.assertFalse(pub & priv)
        self.assertEqual(self.names(techvoc=1), pub | priv)
        # a school can be both a private SHS and a Tech-Voc provider with the same record
        sti = School.objects.get(name__icontains='STI College')
        self.assertEqual(School.objects.filter(name__icontains='STI College').count(), 1)
        self.assertTrue(sti.offers_senior_high and sti.in_techvoc)

    def test_nothing_is_duplicated_and_existing_records_are_kept(self):
        make_school(name="Boater's Wheel Educational System and Technology College", school_type='technical_vocational', offers_senior_high=True)
        make_school(name='STI College Lucena', address='STI Academic Center, Quezon Avenue corner Perez Street, Lucena City')
        call_command('add_senior_high_schools')
        call_command('update_shs_directory')
        n = School.objects.count()
        call_command('update_shs_directory')
        self.assertEqual(School.objects.count(), n)
        self.assertTrue(School.objects.filter(name__icontains='Boater').exists())
        self.assertEqual(School.objects.filter(name__icontains='STI College').count(), 1)
        self.assertEqual(SchoolOffering.objects.filter(school__name__icontains='STI College', kind='strand').count(), 6)

    def test_an_existing_different_address_is_flagged_not_overwritten(self):
        s = make_school(name='Cotta National High School', school_type='public', address='Some Other Road, Cotta, Lucena City', offers_senior_high=True)
        call_command('update_shs_directory')
        s.refresh_from_db()
        self.assertEqual(s.address, 'Some Other Road, Cotta, Lucena City')
        self.assertIn('Address discrepancy', s.verification_note)

    def test_a_generic_address_is_completed(self):
        s = make_school(name='Cotta National High School', school_type='public', offers_senior_high=True)
        call_command('update_shs_directory')
        s.refresh_from_db()
        self.assertEqual(s.address, 'Nicodemus Street, Barangay Cotta, Lucena City')
        self.assertEqual(s.barangay, 'Cotta')

    def test_only_what_was_read_on_an_official_page_is_added(self):
        call_command('update_shs_directory')
        mseuf = School.objects.get(name__icontains='Enverga')
        codes = set(mseuf.offerings.filter(kind='strand').values_list('code', flat=True))
        self.assertEqual(codes, {'HE', 'HUMSS', 'ICT', 'AD', 'STEM', 'ABM'})  # GAS is not on the Lucena pages
        self.assertIn('San Antonio', mseuf.verification_note)
        self.assertTrue(all(o.source_url.startswith('https://mseuf.edu.ph/') for o in mseuf.offerings.all()))
        sti = School.objects.get(name__icontains='STI College')
        self.assertEqual(sti.offerings.filter(kind='strand').count(), 6)
        self.assertEqual(sorted(sti.offerings.filter(kind='tesda').values_list('code', flat=True)), ['Level II', 'Level III'])
        self.assertEqual(sti.phone, '(042) 717-3150')
        # only STI, MSEUF and CEFI were given anything; no other school has a strand or a qualification
        with_offerings = set(SchoolOffering.objects.values_list('school__name', flat=True))
        self.assertEqual(len(with_offerings), 3)
        # the TESDA list of CEFI stays separate from its strands
        cefi = School.objects.get(name__icontains='Calayan')
        self.assertEqual(cefi.offerings.filter(kind='tesda').count(), 4)
        self.assertEqual(cefi.offerings.filter(kind='strand').count(), 5)
        # a school with nothing read on an official page keeps its strands empty
        self.assertEqual(School.objects.get(name='Cotta National High School').offerings.count(), 0)
        self.assertEqual(School.objects.get(name='Cotta National High School').phone, '(042) 785-0876')

    def test_strands_need_an_account_and_are_separate_from_tesda(self):
        call_command('update_shs_directory')
        sti = School.objects.get(name__icontains='STI College')
        SchoolOffering.objects.create(school=sti, kind='tesda', name='Cookery', code='NC II', verification_status='verified')
        SchoolOffering.objects.create(school=sti, kind='strand', name='A pending strand', verification_status='pending')
        visitor = APIClient().get(f'/api/schools/{sti.id}/').data
        self.assertEqual(visitor['strands'], [])
        c = APIClient(); c.force_authenticate(self.user)
        d = c.get(f'/api/schools/{sti.id}/').data
        self.assertEqual(len(d['strands']), 6)  # the pending one is not shown
        self.assertIn('Cookery', [t['name'] for t in d['tesda_programs']])
        self.assertEqual(d['sector'], 'private')
        # search by strand and by qualification (signed in)
        self.assertIn(sti.name, self.names(c, search='Culinary'))
        self.assertIn(sti.name, self.names(c, search='Cookery'))
        self.assertNotIn(sti.name, self.names(APIClient(), search='Culinary'))

    def test_search_by_street_barangay_and_classification(self):
        call_command('update_shs_directory')
        self.assertTrue(any('Cotta' in n for n in self.names(search='Nicodemus')))
        self.assertTrue(any('Ransohan' in n for n in self.names(search='Ransohan')))
        self.assertIn('Cotta National High School', self.names(search='public'))
        self.assertTrue(any('Hyong' in n for n in self.names(search='TESDA')))

    def test_college_finder_is_unchanged(self):
        call_command('update_shs_directory')
        college = {s['name'] for s in APIClient().get('/api/schools/', {'page_size': 200, 'level': 'college'}).data['results']}
        self.assertNotIn('Cotta National High School', college)
        self.assertTrue(any('Southern Luzon' in n for n in college))

    def test_administrator_edits_show_in_the_finder_and_are_logged(self):
        from apps.accounts.models import AuditLog
        call_command('update_shs_directory')
        s = School.objects.get(name='Cotta National High School')
        c = APIClient(); c.force_authenticate(self.admin)
        r = c.patch(f'/api/schools/{s.id}/', {'address': 'New Road, Cotta, Lucena City', 'info_status': 'verified'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        s.refresh_from_db()
        self.assertEqual(s.address, 'New Road, Cotta, Lucena City')
        self.assertIsNotNone(s.last_verified_at)
        self.assertTrue(AuditLog.objects.filter(model_name='School', object_id=s.id).exists())
        self.assertEqual(APIClient().get(f'/api/schools/{s.id}/').data['address'], 'New Road, Cotta, Lucena City')
        # a youth cannot edit
        y = APIClient(); y.force_authenticate(self.user)
        self.assertEqual(y.patch(f'/api/schools/{s.id}/', {'address': 'x'}, format='json').status_code, 403)

    def test_administrator_adds_a_strand_and_archives_a_school(self):
        s = make_school(name='Test SHS', offers_senior_high=True)
        c = APIClient(); c.force_authenticate(self.admin)
        r = c.post('/api/schools/offerings/', {'school': s.id, 'kind': 'strand', 'name': 'STEM', 'code': 'STEM', 'verification_status': 'verified'}, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        self.assertIsNotNone(SchoolOffering.objects.get().verified_at)
        self.assertEqual(self.user and APIClient().post('/api/schools/offerings/', {}, format='json').status_code, 401)
        c.patch(f'/api/schools/{s.id}/', {'is_active': False}, format='json')
        self.assertNotIn('Test SHS', self.names())
        archived = c.get('/api/schools/', {'archived': 1}).data['results']
        self.assertEqual([a['name'] for a in archived], ['Test SHS'])
        self.assertEqual(c.patch(f'/api/schools/{s.id}/', {'is_active': True}, format='json').status_code, 200)
        self.assertIn('Test SHS', self.names())
