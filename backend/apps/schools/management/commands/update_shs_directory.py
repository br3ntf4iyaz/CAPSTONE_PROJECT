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

from ._lucena_master_list import JHS_ONLY, MASTER

DASH = '–'
GENERIC = {'', 'lucena city', 'lucena city, quezon'}
LIST_NOTE = 'Name, address and classification come from the LYDO project list. Not yet checked against the DepEd SDO Lucena City or TESDA records.'
PENDING_SHS = 'The Senior High School offering of this school is still being verified.'
EXT_NOTE = ('Extension / annex: it is listed as a school on the SDO Lucena City public secondary schools page (lucenacity.deped.gov.ph/secondary/), but that page does not say whether it offers Senior High School. '
            'Do not treat it as an independent Senior High provider until confirmed.')

# (name, phrases that identify an existing record, address, barangay, Tech-Voc (TVL track), extra note)
# A private school of the TVL / TESDA list is also a TESDA provider; the public schools of that list are TVL only.
PUBLIC = [
    ('Quezon National High School (QNHS)', ['Quezon National High School'], 'M.L. Tagarao Street, Barangay Iyam, Lucena City', 'Iyam', True,
     'Not listed on the SDO Lucena City public secondary schools page (lucenacity.deped.gov.ph/secondary/). To be confirmed with DepEd.'),
    ('Lucena City National High School (LCNHS)', ['Lucena City National High School'],
     'Purok Sariling Atin, Elvira Razon Aranilla Compound, Maharlika Highway, Barangay Ibabang Dupay, Lucena City', 'Ibabang Dupay', True, ''),
    ('Gulang-Gulang National High School', ['Gulang-gulang National High School'], 'Unson Street, Zaballero Subdivision, Barangay Gulang-Gulang, Lucena City', 'Gulang-Gulang', True, ''),
    ('Cotta National High School', ['Cotta National High School'], 'Nicodemus Street, Barangay Cotta, Lucena City', 'Cotta', True, ''),
    ('Lucena Dalahican National High School', ['Lucena Dalahican National High School', 'Dalahican National High School'], 'Dalahican Road, Barangay Dalahican, Lucena City', 'Dalahican', True, ''),
    ('Ibabang Talim Integrated High School', ['Ibabang Talim Integrated High School'], 'Purok Masayahin, Barangay Ibabang Talim, Lucena City', 'Ibabang Talim', False,
     'The SDO Lucena City profile lists "Gulang-gulang National High School - Ibabang Talim Extension". It may be the same school as this one. Not merged: LYDO to confirm.'),
    ('Ransohan Integrated High School', ['Ransohan Integrated High School'], 'Purok Maligaya, Barangay Ransohan, Lucena City', 'Ransohan', False,
     'Not among the six public Senior High schools named on the SDO Lucena City profile that was read. SHS authorization to be confirmed. '
     'The address adds "Purok Maligaya" as written on the SDO public secondary schools page (the LYDO list gave "Barangay Ransohan").'),
]
EXTENSIONS = [
    ('Lucena City National High School (LCNHS) ' + DASH + ' Mayao Crossing Extension', ['Mayao Crossing Extension'], 'Purok Langka II, Barangay Mayao Crossing, Lucena City', 'Mayao Crossing'),
    ('Lucena City National High School (LCNHS) ' + DASH + ' Ilayang Dupay Extension', ['Ilayang Dupay Extension'], 'Purok Manggahan, Barangay Ilayang Dupay, Lucena City', 'Ilayang Dupay'),
    ('Lucena City National High School (LCNHS) ' + DASH + ' Mayao Castillo Annex', ['Mayao Castillo Annex'], 'Purok Central, Barangay Mayao Castillo, Lucena City', 'Mayao Castillo'),
    ('Lucena City National High School (LCNHS) ' + DASH + ' Silangang Mayao Annex', ['Silangang Mayao Annex'], 'Purok Rosal, Barangay Silangang Mayao, Lucena City', 'Silangang Mayao'),
    ('Lucena Dalahican National High School ' + DASH + ' Barra Annex', ['Barra Annex'], 'Apolonia Subdivision, Barangay Barra, Lucena City', 'Barra'),
]
PRIVATE = [
    ('Sacred Heart College of Lucena City, Inc.', ['Sacred Heart College'], '1 Merchan Street, Lucena City', '', False,
     'The school website (shc.edu.ph) shows Kindergarten to Grade 10 only and no Senior High School offering, while the SDO Lucena City private-school list has it under Senior High School. LYDO to confirm with the school.'),
    ('Maryhill College, Inc.', ['Maryhill'], 'M.L. Tagarao Street, Lucena City', '', False, ''),
    ('St. Anne College Lucena, Inc. (SACLI)', ['St. Anne College', 'Saint Anne College'], 'Diversion Road, Barangay Gulang-Gulang, Lucena City', 'Gulang-Gulang', False, ''),
    ('Manuel S. Enverga University Foundation (MSEUF)', ['Enverga'], 'Enverga Boulevard, University Site, Barangay Ibabang Dupay, Lucena City', 'Ibabang Dupay', False,
     'The LYDO list gave Home Economics and HUMSS for Lucena, and the General Academic Strand (GAS) at the San Antonio campus. The MSEUF Lucena pages show six strands '
     '"Offered in Lucena City" (HUMSS, ICT, HE, AD, STEM, ABM) and do not mention GAS. The strands are taken from the MSEUF pages; GAS is not listed here. LYDO to confirm.'),
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

# Read on the official pages below (nothing else is added). (school phrase, kind, name, code, note, source page)
STI = 'https://www.sti.edu/campuses/lucena'
CEFI = 'https://cefi.edu.ph/programs/'
MSEUF = 'https://mseuf.edu.ph/bed/programs/'
OFFERINGS = [
    ('STI College', 'strand', 'Hospitality and Tourism ' + DASH + ' Culinary Arts', 'HTCUA', '', STI),
    ('STI College', 'strand', 'Hospitality and Tourism ' + DASH + ' Tourism Operations', 'HTTO', '', STI),
    ('STI College', 'strand', 'Arts, Social Sciences, and Humanities', 'ASSH', '', STI),
    ('STI College', 'strand', 'Business and Entrepreneurship', 'B&E', '', STI),
    ('STI College', 'strand', 'Science, Technology, Engineering, and Mathematics ' + DASH + ' Engineering, Technology, and Mathematics', 'STEM-ETM', '', STI),
    ('STI College', 'strand', 'ICT Support and Computer Programming Technologies', 'ICT-SCPT', '', STI),
    ('STI College', 'tesda', 'Data Collection and Annotation ' + DASH + ' Data Science-Artificial Intelligence', 'Level II', '', STI),
    ('STI College', 'tesda', 'AI Prompting and Automation', 'Level III', '', STI),
    ('Enverga', 'strand', 'Humanities and Social Sciences', 'HUMSS', 'Offered in Lucena City', MSEUF + 'shs-humss'),
    ('Enverga', 'strand', 'Information and Communications Technology', 'ICT', 'Offered in Lucena City', MSEUF + 'shs-ict'),
    ('Enverga', 'strand', 'Home Economics', 'HE', 'Offered in Lucena City', MSEUF + 'shs-he'),
    ('Enverga', 'strand', 'Arts & Design', 'AD', 'Offered in Lucena City', MSEUF + 'shs-ad'),
    ('Enverga', 'strand', 'Science, Technology, and Engineering', 'STEM', 'Offered in Lucena City', MSEUF + 'shs-stem'),
    ('Enverga', 'strand', 'Accounting, Business, and Management', 'ABM', 'Offered in Lucena City', MSEUF + 'shs-abm-bed'),
    ('Calayan', 'strand', 'Science, Technology, Engineering and Mathematics', 'STEM', 'Academic Track', CEFI),
    ('Calayan', 'strand', 'Humanities and Social Sciences', 'HUMSS', 'Academic Track', CEFI),
    ('Calayan', 'strand', 'Accountancy, Business and Management', 'ABM', 'Academic Track', CEFI),
    ('Calayan', 'strand', 'Home Economics', 'HE', 'Technical-Vocational Track', CEFI),
    ('Calayan', 'strand', 'Information and Communications Technology', 'ICT', 'Technical-Vocational Track', CEFI),
    ('Calayan', 'tesda', 'Caregiving', 'NC II', '', CEFI),
    ('Calayan', 'tesda', 'Health Care Services', 'NC II', '', CEFI),
    ('Calayan', 'tesda', 'Cookery', 'NC II', '', CEFI),
    ('Calayan', 'tesda', 'Food and Beverage Services', 'NC II', '', CEFI),
]
# contacts read on official pages; only an empty field is filled
SDO = 'https://lucenacity.deped.gov.ph/secondary/'
CONTACTS = {
    'Lucena City National High School (LCNHS)': {'phone': '(042) 784-2557', 'email': '301501@deped.gov.ph', 'source_url': SDO},
    'Gulang-Gulang National High School': {'phone': '(042) 713-0426', 'email': '308503@deped.gov.ph', 'source_url': SDO},
    'Cotta National High School': {'phone': '(042) 785-0876', 'source_url': SDO},
    'Lucena Dalahican National High School': {'phone': '(042) 784-2026', 'email': '308501@deped.gov.ph', 'source_url': SDO},
    'Ibabang Talim Integrated High School': {'email': '308504@deped.gov.ph', 'source_url': SDO},
    'Ransohan Integrated High School': {'phone': '(042) 717-3884', 'email': '500427@deped.gov.ph', 'source_url': SDO},
    'Lucena City National High School (LCNHS) ' + DASH + ' Ilayang Dupay Extension': {'phone': '(042) 785-0814', 'email': '308509@deped.gov.ph'},
    'Lucena City National High School (LCNHS) ' + DASH + ' Mayao Crossing Extension': {'phone': '(042) 785-6857'},
    'Lucena City National High School (LCNHS) ' + DASH + ' Mayao Castillo Annex': {'email': 'mayaocastillolcnhs@gmail.com'},
    'Lucena City National High School (LCNHS) ' + DASH + ' Silangang Mayao Annex': {'email': 'lcnhssmex@gmail.com'},
    'Lucena Dalahican National High School ' + DASH + ' Barra Annex': {'email': '308507@deped.gov.ph'},
    'STI College Lucena': {'phone': '(042) 717-3150', 'website': STI, 'facebook_url': 'https://www.facebook.com/lucena.sti.edu'},
    'Calayan Educational Foundation, Inc. (CEFI)': {'phone': '(042) 710-2514', 'email': 'info@cefi.edu.ph', 'website': 'https://cefi.edu.ph', 'facebook_url': 'https://www.facebook.com/cefiph'},
    'Maryhill College, Inc.': {'phone': '(042) 373-0165', 'email': 'maryhill@maryhillcollege.edu.ph', 'website': 'https://maryhillcollege.edu.ph', 'facebook_url': 'https://www.facebook.com/maryhillcollege'},
    'Manuel S. Enverga University Foundation (MSEUF)': {'phone': '(042) 710-2541', 'website': 'https://mseuf.edu.ph', 'facebook_url': 'https://www.facebook.com/EnvergaU'},
    'Sacred Heart College of Lucena City, Inc.': {'website': 'https://shc.edu.ph', 'facebook_url': 'https://www.facebook.com/sacred.heart.college.official'},
}
# a private school whose own page lists TESDA programs (NC II) and the TVL track, though it is not on the LYDO Tech-Voc / TESDA list
TESDA_VERIFIED = {'Calayan Educational Foundation, Inc. (CEFI)'}
# schools whose name, address, contacts and strands were all read on an official page (marked Verified)
VERIFIED = {'STI College Lucena', 'Calayan Educational Foundation, Inc. (CEFI)', 'Lucena City National High School (LCNHS)',
            'Gulang-Gulang National High School', 'Cotta National High School', 'Lucena Dalahican National High School'}


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


def _similar(a, b):
    """True when two addresses name the same place, ignoring 'Brgy', 'Barangay', the postal code and word order."""
    skip = {'brgy', 'barangay', 'lucena', 'city', 'quezon', '4301', 'street', 'st', 'avenue', 'ave', 'road', 'rd', 'highway', 'hwy', 'purok'}
    ta = {w for w in _norm(a).split() if w not in skip}
    tb = {w for w in _norm(b).split() if w not in skip}
    if not ta or not tb:
        return False
    return len(ta & tb) / len(ta | tb) >= 0.5


def _note(school, text):
    if text and text not in (school.verification_note or ''):
        school.verification_note = ((school.verification_note or '').rstrip() + '\n' + text).strip()


class Command(BaseCommand):
    help = 'Complete the Senior High School part of the School Finder (classification, addresses, Tech-Voc / TESDA, verified strands).'

    def _apply(self, name, phrases, kind, address, barangay, techvoc, extra, shs=True, shs_note='', created_note=LIST_NOTE, tesda=False):
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
            school.offers_tvl = True
        if tesda:
            school.tesda_provider = True
        if shs_note and not school.shs_note:
            school.shs_note = shs_note
        _note(school, extra)
        for field, value in CONTACTS.get(name, {}).items():
            if not getattr(school, field):
                setattr(school, field, value)
        if name in VERIFIED and school.info_status == 'pending':
            school.info_status = 'verified'
            school.last_verified_at = timezone.now()
        school.save()
        return school

    def _master(self):
        """Levels and categories of the LYDO master list: added to what a school already has, never removed. Missing schools are added."""
        for name, phrases, kind, address, levels, tags in MASTER:
            school = _find(name, phrases)
            if school is None:
                school = School(name=name, school_type=kind, address=address or 'Lucena City, Quezon', municipality='Lucena City', province='Quezon',
                                region='Region IV-A (CALABARZON)', offers_college=False, offers_senior_high=False, info_status='pending',
                                verification_note=LIST_NOTE, is_active=True)
                match = re.search(r'Brgy\.\s*([^,]+)', address or '')
                if match:
                    school.barangay = match.group(1).strip()
                self.added += 1
            else:
                self.updated += 1
                if address and not _similar(school.address, address):
                    if _norm(school.address) in {_norm(g) for g in GENERIC} or not school.address:
                        school.address = address
                    else:
                        _note(school, f'Address discrepancy: the LYDO master list gives "{address}", the School Finder has "{school.address}". Kept the existing one: LYDO to confirm.')
                        self.flags.append(school.name)
            before = (school.offers_college, school.offers_senior_high, school.offers_tvet, school.offers_tvl, school.tesda_provider)
            # a school the list does not give a College level (a TESDA center, a Senior High School) is not listed under College
            school.offers_college = 'college' in levels
            school.offers_senior_high = school.offers_senior_high or 'shs' in levels
            school.offers_tvet = school.offers_tvet or 'tvet' in levels
            school.offers_tvl = school.offers_tvl or 'tvl' in tags
            school.tesda_provider = school.tesda_provider or 'tesda' in tags
            if before != (school.offers_college, school.offers_senior_high, school.offers_tvet, school.offers_tvl, school.tesda_provider):
                _note(school, 'Levels and categories (Senior High, College, TVET, Tech-Voc, TESDA) come from the LYDO master list and are not yet checked against DepEd / CHED / TESDA records.')
            school.save()

    def _merge_ibabang_talim(self):
        """The SDO profile lists "Gulang-gulang NHS - Ibabang Talim Extension"; the SDO school list and the LYDO list have "Ibabang Talim Integrated High School".
        They are the same place, so the older entry is archived (not deleted) and only the integrated high school is shown."""
        keep = School.objects.filter(name__iexact='Ibabang Talim Integrated High School', is_active=True).first()
        if not keep:
            return
        for old in School.objects.filter(name__icontains='Ibabang Talim Extension', is_active=True).exclude(pk=keep.pk):
            old.is_active = False
            _note(old, 'Archived as a duplicate of "Ibabang Talim Integrated High School", which the DepEd SDO Lucena City school list shows as its own school. Restore it in the admin page if they are different schools.')
            old.save()
            _note(keep, 'An older entry, "' + old.name + '", was archived as the same school.')
            keep.save()

    def _jhs_only(self):
        """The annexes and extensions that the LYDO list says are Junior High only are taken out of the Senior High results (archived, not deleted)."""
        for phrase in JHS_ONLY:
            for school in School.objects.filter(name__icontains=phrase, municipality__icontains='Lucena'):
                school.offers_senior_high = False
                school.shs_note = ''
                school.is_active = False
                _note(school, 'Left out of the Senior High results: the LYDO list says this extension / annex is Junior High School only. Restore it in the admin page if it does offer Senior High.')
                school.save()

    def handle(self, *args, **options):
        self.added = self.updated = 0
        self.flags = []
        for name, phrases, address, brgy, tv, extra in PUBLIC:
            self._apply(name, phrases, 'public', address, brgy, tv, extra)
        for name, phrases, address, brgy, tv, extra in PRIVATE:
            unverified = 'SHS authorization' in extra
            self._apply(name, phrases, 'private', address, brgy, tv or name in TESDA_VERIFIED, extra, shs_note=PENDING_SHS if unverified else '', tesda=tv or name in TESDA_VERIFIED)

        self._master()
        self._jhs_only()
        self._merge_ibabang_talim()

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

        # strands and TESDA qualifications that were read on an official page
        now = timezone.now()
        for phrase, kind, name, code, note, source in OFFERINGS:
            school = _find(phrase, [phrase])
            if not school:
                continue
            SchoolOffering.objects.update_or_create(
                school=school, kind=kind, name=name,
                defaults={'code': code, 'note': note, 'source_url': source, 'source_note': '', 'verification_status': 'verified', 'verified_at': now},
            )

        total = School.objects.filter(offers_senior_high=True).count()
        self.stdout.write(self.style.SUCCESS(f'Done. {self.added} schools added, {self.updated} updated. {total} Senior High schools in the finder.'))
        if self.flags:
            self.stdout.write('Address differences kept for LYDO to review:\n  ' + '\n  '.join(self.flags))
