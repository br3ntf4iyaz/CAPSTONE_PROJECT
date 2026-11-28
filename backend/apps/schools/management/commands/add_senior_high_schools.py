"""Add the Senior High Schools of Lucena City to the School Finder, so the scholarship form can offer them in a dropdown.

Every name below was read on a Schools Division Office (SDO) Lucena City page of DepEd:
  - PUBLIC: https://lucenacity.deped.gov.ph/history-and-profile/ (profile for school year 2022-2023). It says that six public secondary
    schools offer Senior High School and names them.
  - PRIVATE: https://lucenacity.deped.gov.ph/private-schools/ (list of private schools authorized to operate, school year 2025-2026),
    the schools that have an entry under Senior High School.

What is NOT claimed: which strands each school offers. No page gave that for each school. The SDO profile says only that the initial SHS
offerings of the public schools include the General Academic, Accountancy, Business and Management, Science, Technology, Engineering and
Mathematics, and Technical-Vocational-Livelihood strands, so that is all the note says. The scholarship form lets the applicant choose
their own strand. LYDO can confirm and add the strands of each school.

A school that already exists in the School Finder (a college that also has a Senior High School) is not duplicated: it is only marked as
also offering Senior High. Safe to run again.

    python manage.py add_senior_high_schools
"""
from django.core.management.base import BaseCommand

from apps.schools.models import School

PUBLIC_SOURCE = 'https://lucenacity.deped.gov.ph/history-and-profile/'
PRIVATE_SOURCE = 'https://lucenacity.deped.gov.ph/private-schools/'
PUBLIC_NOTE = ('Listed by the DepEd Schools Division Office of Lucena City among the six public secondary schools that offer Senior High School '
               '(school profile for SY 2022-2023). The strands this school offers are not confirmed. The same page names the General Academic, '
               'Accountancy, Business and Management, Science, Technology, Engineering and Mathematics, and Technical-Vocational-Livelihood strands as the '
               'initial Senior High offerings of these schools.')
PRIVATE_NOTE = ('Listed by the DepEd Schools Division Office of Lucena City among the private schools authorized to operate (SY 2025-2026) with a '
                'Senior High School entry. The strands this school offers are not confirmed. Please confirm with the school.')

# (name as written on the page, phrases that identify an existing School Finder entry of the same school)
PUBLIC = [
    ('Lucena City National High School', ['Lucena City National High School']),
    ('Lucena Dalahican National High School', ['Dalahican National High School']),
    ('Gulang-gulang National High School', ['Gulang-gulang National High School', 'Gulang-Gulang National High School']),
    ('Cotta National High School', ['Cotta National High School']),
    ('Gulang-gulang National High School - Ibabang Talim Extension', ['Ibabang Talim Extension']),
    ('Mayao Parada Agricultural Integrated School', ['Mayao Parada']),
]
PRIVATE = [
    ('AMA Computer College-Lucena City', ['AMA Computer College']),
    ("Boater's Wheel Educational System and Technology College", ['Boater', 'BWEST']),
    ('Inter-Global College Foundation, Inc.', ['Inter-Global']),
    ('St. Augustine School of Nursing-Lucena City', ['Augustine School of Nursing']),
    ('STI Education Services Group, Inc. - Lucena', ['STI College', 'STI Education']),
    ('Calayan Educational Foundation Inc.', ['Calayan']),
    ("Children's House-A Montessori School", ["Children's House"]),
    ('Holy Rosary Catholic School', ['Holy Rosary']),
    ('International School for Better Beginnings', ['International School for Better Beginnings']),
    ('UCCP Magill Memorial School Incorporated', ['Magill']),
    ('Manuel S. Enverga University Foundation', ['Enverga']),
    ('Maryhill College', ['Maryhill']),
    ('Philippine Tong Ho Institute', ['Tong Ho']),
    ('Sacred Heart College', ['Sacred Heart College']),
    ('Saint Philomena School', ['Philomena']),
    ('Scuola Gesu Bambino', ['Gesu Bambino']),
    ('St. Anne College Lucena, Inc.', ['St. Anne College', 'Saint Anne College']),
    ('Ark Technological Institute Education System, Inc.', ['Ark Technological']),
    ('Digitech College (Digital Communication and Technological College, Inc.)', ['Digitech', 'Digital Communication and Technological']),
    ('Philtech Institute of Arts and Technology Inc.-Lucena City', ['Philtech']),
    ('College of Sciences, Technology and Communications, Inc. (CSTC)', ['CSTC', 'College of Sciences, Technology and Communications']),
    ('St. Michael TVET Training and Assessment Center, Inc.', ['St. Michael TVET']),
    ('Hyong Yang Institute of Technology Inc.', ['Hyong Yang']),
    ('Community Technological College Inc.', ['Community Technological College']),
    ('Bristol Integrated School Inc.', ['Bristol Integrated']),
]


class Command(BaseCommand):
    help = 'Add the Senior High Schools of Lucena City (names read on the DepEd SDO Lucena pages) to the School Finder.'

    def _existing(self, phrases):
        for ph in phrases:
            found = School.objects.filter(name__icontains=ph, municipality__icontains='Lucena').first()
            if found:
                return found
        return None

    def handle(self, *args, **options):
        added = marked = 0
        for group, kind, source, note in (('public', 'public', PUBLIC_SOURCE, PUBLIC_NOTE), ('private', 'private', PRIVATE_SOURCE, PRIVATE_NOTE)):
            for name, phrases in (PUBLIC if group == 'public' else PRIVATE):
                school = self._existing(phrases)
                if school:
                    if not school.offers_senior_high:
                        school.offers_senior_high = True
                        school.save(update_fields=['offers_senior_high'])
                        marked += 1
                        self.stdout.write(self.style.SUCCESS(f'  also Senior High: {school.name}'))
                    else:
                        self.stdout.write(f'  already there: {school.name}')
                    continue
                School.objects.create(
                    name=name, school_type=kind, address='Lucena City, Quezon', municipality='Lucena City', province='Quezon',
                    region='Region IV-A (CALABARZON)', source_url=source, verification_note=note,
                    offers_college=False, offers_senior_high=True, is_active=True,
                )
                added += 1
                self.stdout.write(self.style.SUCCESS(f'  added: {name}'))
        self.stdout.write(self.style.SUCCESS(f'Done. {added} added, {marked} existing schools marked as also Senior High.'))
