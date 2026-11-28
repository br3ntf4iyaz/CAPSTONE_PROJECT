"""Complete the Senior High School part of the School Finder: classification, complete addresses, Tech-Voc / TESDA listing, verified strands.

The school list, the addresses and the Tech-Voc / TESDA lists come from the LYDO project list. They are stored, but they are NOT marked
Verified: a school is marked "Pending verification" until an administrator checks it against DepEd / TESDA records and marks it Verified.

Rules followed:
  * An existing school is updated, never duplicated (it is found by name). A school is never removed.
  * An address that already exists and differs from the list is NOT overwritten: the difference is written in the internal note for the
    administrator to decide.
  * A strand or TESDA qualification is added only when it was given with its source. Everything else stays empty ("Strand information not
    yet available") for the administrator to fill in.
  * A school that already has a different name in the School Finder than in the list is kept under its own name and the difference is noted.

    python manage.py update_shs_directory
"""
import re

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.schools.models import School, SchoolOffering

DASH = '–'
GENERIC = {'', 'lucena city', 'lucena city, quezon'}
LIST_NOTE = 'Name, address and classification come from the LYDO project list. Not yet checked against the DepEd SDO Lucena City or TESDA records.'
PENDING_SHS = 'The Senior High School offering of this school is still being verified.'
EXT_NOTE = ('Extension / annex: whether it offers Senior High School on its own, and its current operating status, are not verified. '
            'Do not treat it as an independent Senior High provider until confirmed.')
STRAND_NOTE = 'Provided by the LYDO project list as the published Senior High School offering of the school. Attach the official page when it is confirmed.'

# (name, phrases that identify an existing record, type, address, barangay, techvoc, extra note)
PUBLIC = [
    ('Quezon National High School (QNHS)', ['Quezon National High School'], 'M.L. Tagarao Street, Barangay Iyam, Lucena City', 'Iyam', True, ''),
    ('Lucena City National High School (LCNHS)', ['Lucena City National High School'],
     'Purok Sariling Atin, Elvira Razon Aranilla Compound, Maharlika Highway, Barangay Ibabang Dupay, Lucena City', 'Ibabang Dupay', True, ''),
    ('Gulang-Gulang National High School', ['Gulang-gulang National High School'], 'Unson Street, Zaballero Subdivision, Barangay Gulang-Gulang, Lucena City', 'Gulang-Gulang', True, ''),
    ('Cotta National High School', ['Cotta National High School'], 'Nicodemus Street, Barangay Cotta, Lucena City', 'Cotta', True, ''),
    ('Lucena Dalahican National High School', ['Lucena Dalahican National High School', 'Dalahican National High School'], 'Dalahican Road, Barangay Dalahican, Lucena City', 'Dalahican', True, ''),
    ('Ibabang Talim Integrated High School', ['Ibabang Talim Integrated High School'], 'Purok Masayahin, Barangay Ibabang Talim, Lucena City', 'Ibabang Talim', False,
     'The SDO Lucena City profile lists "Gulang-gulang National High School - Ibabang Talim Extension". It may be the same school as this one. Not merged: LYDO to confirm.'),
    ('Ransohan Integrated High School', ['Ransohan Integrated High School'], 'Barangay Ransohan, Lucena City', 'Ransohan', False,
     'Not among the six public Senior High schools named on the SDO Lucena City profile that was read. SHS authorization to be confirmed.'),
]
EXTENSIONS = [
    ('Lucena City National High School (LCNHS) ' + DASH + ' Mayao Crossing Extension', ['Mayao Crossing Extension'], 'Purok Langka II, Barangay Mayao Crossing, Lucena City', 'Mayao Crossing'),
    ('Lucena City National High School (LCNHS) ' + DASH + ' Ilayang Dupay Extension', ['Ilayang Dupay Extension'], 'Purok Manggahan, Barangay Ilayang Dupay, Lucena City', 'Ilayang Dupay'),
    ('Lucena City National High School (LCNHS) ' + DASH + ' Mayao Castillo Annex', ['Mayao Castillo Annex'], 'Purok Central, Barangay Mayao Castillo, Lucena City', 'Mayao Castillo'),
    ('Lucena City National High School (LCNHS) ' + DASH + ' Silangang Mayao Annex', ['Silangang Mayao Annex'], 'Purok Rosal, Barangay Silangang Mayao, Lucena City', 'Silangang Mayao'),
    ('Lucena Dalahican National High School ' + DASH + ' Barra Annex', ['Barra Annex'], 'Apolonia Subdivision, Barangay Barra, Lucena City', 'Barra'),
]
PRIVATE = [
    ('Sacred Heart College of Lucena City, Inc.', ['Sacred Heart College'], '1 Merchan Street, Lucena City', '', False, ''),
    ('Maryhill College, Inc.', ['Maryhill'], 'M.L. Tagarao Street, Lucena City', '', False, ''),
    ('St. Anne College Lucena, Inc. (SACLI)', ['St. Anne College', 'Saint Anne College'], 'Diversion Road, Barangay Gulang-Gulang, Lucena City', 'Gulang-Gulang', False, ''),
    ('Manuel S. Enverga University Foundation (MSEUF)', ['Enverga'], 'Enverga Boulevard, University Site, Barangay Ibabang Dupay, Lucena City', 'Ibabang Dupay', False,
     'The General Academic Strand (GAS) of MSEUF is offered at the San Antonio campus, not in Lucena City, so it is not listed here.'),
    ('Calayan Educational Foundation, Inc. (CEFI)', ['Calayan', 'CEFI'], 'Maharlika Highway, Barangay Ibabang Dupay, Lucena City', 'Ibabang Dupay', False, ''),
    ('Bristol Integrated School', ['Bristol Integrated'], 'Km. 133 Diversion Road, Barangay Kanlurang Mayao, Lucena City', 'Kanlurang Mayao', False, ''),
    ('Children\'s House of Annunciation Montessori School (CHAMS)', ["Children's House", 'Annunciation Montessori'], 'Don Crisanto Street, Barangay Market View, Lucena City', 'Market View', False,
     'The SDO Lucena City list names it "Children\'s House-A Montessori School". The LYDO list names it "Children\'s House of Annunciation Montessori School". Kept under the existing name: LYDO to confirm.'),
    ('Holy Rosary Catholic School', ['Holy Rosary'], 'Quezon Avenue Extension, Barangay Cotta, Lucena City', 'Cotta', False, ''),
    ('International School for Better Beginnings (ISBB)', ['International School for Better Beginnings'], '9141 Moscow Street, University Site, Barangay Ibabang Dupay, Lucena City', 'Ibabang Dupay', False, ''),
    ('Lucena Hope Academy', ['Lucena Hope Academy'], 'Lot 6 & 7, Block 8, Phase V-A, Kalayaan Avenue corner Iriga Street, Calmar Homes, Barangay Kanlurang Mayao, Lucena City', 'Kanlurang Mayao', False,
     'Not among the Senior High entries recorded from the SDO Lucena City private-school list. SHS authorization to be confirmed.'),
    ('Maranatha Christian Academy', ['Maranatha Christian Academy'], 'No. 1648, corner Narra and Maulawin Streets, Campo Subdivision, Barangay Gulang-Gulang, Lucena City', 'Gulang-Gulang', False,
     'Not among the Senior High entries recorded from the SDO Lucena City private-school list. SHS authorization to be confirmed.'),
    ('Saint Philomena School', ['Philomena'], '1106 Sampaguita Street, Employees Village Subdivision, Barangay Gulang-Gulang, Lucena City', 'Gulang-Gulang', False, ''),
    ('Twin Hearts Integrated School', ['Twin Hearts'], '1201 Daleon Street, North Employees Village, Barangay Gulang-Gulang, Lucena City', 'Gulang-Gulang', False,
     'Not among the Senior High entries recorded from the SDO Lucena City private-school list. SHS authorization to be confirmed.'),
    ('AMA Computer College ' + DASH + ' Lucena City', ['AMA Computer College'], 'Tantuco Building, No. 160 M.L. Tagarao Street, Barangay Iyam, Lucena City', 'Iyam', True, ''),
    ('Ark Technological Institute Education System, Inc.', ['Ark Technological'], 'J Seven Building, Magallanes corner Granja Street, Barangay 7, Lucena City', 'Barangay 7', True, ''),
    ('College of Sciences, Technology and Communications, Inc. (CSTC)', ['CSTC', 'College of Sciences, Technology and Communications'], '28 Capitol Road, Purok Camia, Barangay 10, Lucena City', 'Barangay 10', True, ''),
    ('Community Technological College Inc.', ['Community Technological College'], 'Pleasantville Subdivision, Barangay Ilayang Iyam, Lucena City', 'Ilayang Iyam', False, ''),
    ('Digitech College (Digital Communication and Technological College, Inc.)', ['Digitech', 'Digital Communication and Technological'], 'Purok Agawin, Barangay Ibabang Dupay, Lucena City', 'Ibabang Dupay', True, ''),
    ('Hyong Yang Institute of Technology Inc.', ['Hyong Yang'], '88 Enriquez Street, Barangay 4, Lucena City', 'Barangay 4', True, ''),
    ('Inter-Global College Foundation, Inc.', ['Inter-Global'], 'Barangay Bocohan, Lucena City', 'Bocohan', True, ''),
    ('Philtech Institute of Arts and Technology Inc. ' + DASH + ' Lucena City', ['Philtech'], '2nd Floor, SY Building, Maharlika Highway, Barangay Ibabang Dupay, Lucena City', 'Ibabang Dupay', True, ''),
    ('STI College Lucena', ['STI College', 'STI Education'], 'Quezon Avenue corner Perez Street, Lucena City', '', True, ''),
    ('St. Augustine School of Nursing ' + DASH + ' Lucena City', ['Augustine School of Nursing'], '2/F Carlos City Center, M.L. Tagarao Street corner Quezon Avenue, Lucena City', '', True, ''),
    ('St. Michael TVET Training and Assessment Center, Inc.', ['St. Michael TVET'], '3/F Pagkatipunan Building, Profugo corner Merchan Street, Barangay 6, Lucena City', 'Barangay 6', True, ''),
]

SLSU_NOTE = ('Southern Luzon State University (SLSU) ' + DASH + ' Lucena Campus is located in Purok Baybayin, Barangay Ibabang Dupay, Lucena City. '
             'However, this campus primarily offers college and TESDA programs. Its Senior High School program is located at the SLSU Main Campus '
             'in Lucban, Quezon, not in Lucena City.')

# strands given with their source: (phrase of the school, [(name, code)], note)
STRANDS = {
    'STI College': [
        ('Hospitality and Tourism ' + DASH + ' Culinary Arts', 'HTCUA'),
        ('Hospitality and Tourism ' + DASH + ' Tourism Operations', 'HTTO'),
        ('Arts, Social Sciences, and Humanities', 'ASSH'),
        ('Business and Entrepreneurship', 'B&E'),
        ('Science, Technology, Engineering, and Mathematics ' + DASH + ' Engineering, Technology, and Mathematics', 'STEM-ETM'),
        ('ICT Support and Computer Programming Technologies', 'ICT-SCPT'),
    ],
    'Enverga': [
        ('Home Economics', 'HE'),
        ('Humanities and Social Sciences', 'HUMSS'),
    ],
}


def _norm(text):
    return re.sub(r'[^a-z0-9]+', ' ', (text or '').lower()).strip()


def _find(name, phrases):
    exact = School.objects.filter(name__iexact=name, municipality__icontains='Lucena').first()
    if exact:
        return exact
    for ph in phrases:
        hits = list(School.objects.filter(name__icontains=ph, municipality__icontains='Lucena'))
        # "Gulang-gulang National High School" must not pick its own extension: the shortest name is the school itself
        hits = [h for h in hits if not any(w in h.name.lower() for w in ('extension', 'annex')) or any(w in ph.lower() for w in ('extension', 'annex'))]
        if hits:
            return sorted(hits, key=lambda h: len(h.name))[0]
    return None


def _note(school, text):
    if text and text not in (school.verification_note or ''):
        school.verification_note = ((school.verification_note or '').rstrip() + '\n' + text).strip()


class Command(BaseCommand):
    help = 'Complete the Senior High School part of the School Finder (classification, addresses, Tech-Voc / TESDA, verified strands).'

    def _apply(self, name, phrases, kind, address, barangay, techvoc, extra, shs=True, shs_note='', created_note=LIST_NOTE):
        school = _find(name, phrases)
        is_new = school is None
        if is_new:
            school = School(name=name, school_type=kind, address=address, municipality='Lucena City', province='Quezon',
                            region='Region IV-A (CALABARZON)', offers_college=False, offers_senior_high=shs, info_status='pending',
                            verification_note=created_note, is_active=True)
            self.added += 1
        else:
            if _norm(school.address) in {_norm(g) for g in GENERIC} or not school.address:
                school.address = address
            elif _norm(school.address) != _norm(address):
                _note(school, f'Address discrepancy: the LYDO list gives "{address}", the School Finder had "{school.address}". Kept the existing one: LYDO to confirm.')
                self.flags.append(school.name)
            if shs and not school.offers_senior_high:
                school.offers_senior_high = True
            self.updated += 1
        if barangay and not school.barangay:
            school.barangay = barangay
        if techvoc:
            school.in_techvoc = True
        if shs_note and not school.shs_note:
            school.shs_note = shs_note
        _note(school, extra)
        school.save()
        return school

    def handle(self, *args, **options):
        self.added = self.updated = 0
        self.flags = []
        for name, phrases, address, brgy, tv, extra in PUBLIC:
            self._apply(name, phrases, 'public', address, brgy, tv, extra)
        for name, phrases, address, brgy in EXTENSIONS:
            self._apply(name, phrases, 'public', address, brgy, False, EXT_NOTE, shs_note=PENDING_SHS, created_note=LIST_NOTE + ' ' + EXT_NOTE)
        for name, phrases, address, brgy, tv, extra in PRIVATE:
            unverified = 'SHS authorization' in extra
            self._apply(name, phrases, 'private', address, brgy, tv, extra, shs_note=PENDING_SHS if unverified else '')

        # SLSU Lucena Campus: a college / TESDA campus, NOT a Senior High provider
        slsu = _find('Southern Luzon State University (SLSU) ' + DASH + ' Lucena Campus', ['Southern Luzon State University'])
        if slsu is None:
            slsu = School(name='Southern Luzon State University (SLSU) ' + DASH + ' Lucena Campus', school_type='state_university', municipality='Lucena City',
                          province='Quezon', region='Region IV-A (CALABARZON)', address='Purok Baybayin, Barangay Ibabang Dupay, Lucena City', offers_college=True,
                          info_status='pending', verification_note=LIST_NOTE)
            self.added += 1
        else:
            self.updated += 1
            if _norm(slsu.address) in {_norm(g) for g in GENERIC}:
                slsu.address = 'Purok Baybayin, Barangay Ibabang Dupay, Lucena City'
        slsu.offers_senior_high = False
        slsu.barangay = slsu.barangay or 'Ibabang Dupay'
        slsu.shs_note = SLSU_NOTE
        slsu.save()

        # strands that came with their source
        now = timezone.now()
        for phrase, rows in STRANDS.items():
            school = _find(phrase, [phrase])
            if not school:
                continue
            for name, code in rows:
                SchoolOffering.objects.update_or_create(
                    school=school, kind='strand', name=name,
                    defaults={'code': code, 'verification_status': 'verified', 'verified_at': now, 'source_note': STRAND_NOTE,
                              'note': 'Lucena City' if phrase == 'Enverga' else ''},
                )

        total = School.objects.filter(offers_senior_high=True).count()
        self.stdout.write(self.style.SUCCESS(f'Done. {self.added} schools added, {self.updated} updated. {total} Senior High schools in the finder.'))
        if self.flags:
            self.stdout.write('Address differences kept for LYDO to review:\n  ' + '\n  '.join(self.flags))
