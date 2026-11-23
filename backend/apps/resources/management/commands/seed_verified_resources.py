"""
Adds real, link-checked learning materials to the Resources library
(Education, Leadership, Financial, Governance and Other categories).

Rules followed for every entry:
  * the link was opened and answered correctly on VERIFIED_ON;
  * descriptions only repeat what the source page, file name or document itself says;
  * a field that could not be confirmed (a year, an author) is left empty, never guessed.

Safe to run again: existing records are updated, never duplicated, and records that are not in
this list are never touched.

    python manage.py seed_verified_resources
"""
from datetime import date

from django.core.management.base import BaseCommand

from apps.resources.models import Resource

# The day the links below were checked. It is fixed on purpose: running this command later must not
# make the library claim the links were checked on that later day.
VERIFIED_ON = date(2026, 11, 24)

NYC_DOWNLOADS = 'https://nyc.gov.ph/downloadables'
DILG_MANILA_SK = 'https://manila.ncr.dilg.gov.ph/e-library/sk-manual'


def drive(file_id):
    return (
        f'https://drive.google.com/file/d/{file_id}/view',
        f'https://drive.google.com/uc?export=download&id={file_id}',
    )


def pdf(title, desc, cat, author, source_url, read, download=None, year=None, kind='government', tags='',
        note='', featured=False, material='pdf', law=''):
    return dict(
        title=title, description=desc, category=cat, resource_type='document', material_type=material, author=author,
        source_url=source_url, external_url=read, download_url=download or read, year_enacted=year,
        source_kind=kind, tags=tags, status_note=note, is_featured=featured, law_number=law,
    )


def site(title, desc, cat, author, url, kind='government', tags='', source_url='', material='website'):
    return dict(
        title=title, description=desc, category=cat, resource_type='link', material_type=material, author=author,
        source_url=source_url or url, external_url=url, download_url='', year_enacted=None,
        source_kind=kind, tags=tags, status_note='', is_featured=False, law_number='',
    )


OPS = drive('1YJds-dx5ysaFT4MibG7QZYfHHsnMcC8m')
HANDBOOK = drive('1BT0DVSvXqBbM4I8WGvxe5zwxPqcMYxND')
PYDP = drive('1dcIQfgzZWYWhL6usBFAF6Xo1xLEyuw7f')
YORP_MEMBERS = drive('1TiGWil4zFR4AP3B4x06GrcK7GxCzqYfz')
YORP_LYDO = drive('18ZXTShLCRk3kOv8iNimqPiXd5lu9gayo')
YORP_ANNUAL = drive('1Yk64vMm13pCN2W0PFhfwqjsi2GKVpWZa')
YORP_SGLG = drive('1ZuoBT646hyWbfg7z1_B59fD15P7wl3lW')
YORP_FAQ = drive('1DwlXEjPRdCIP0-wOuoMT5BzLoTvlstBJ')

DBM = 'https://www.dbm.gov.ph/wp-content/uploads/Issuances/'
TESDA_CS = ('https://tesda.gov.ph/Downloadables/CS/CS%20-%20Bookkeeping%20for%20Sangguniang%20Kabataan%20'
            '(SK)%20Financial%20Transactions%20Level%20II%20v2.pdf')
NYC_NOTE = 'Listed on the National Youth Commission Downloadables page.'

RESOURCES = [
    # ── LEADERSHIP ────────────────────────────────────────────────────────────
    pdf('Sangguniang Kabataan Operations Manual 2023',
        'Operations manual for Sangguniang Kabataan officials. The file is named "SK-Operations-Manual-2023" and is listed in the '
        'SK Manual section of the DILG Manila Sub-LG Resource Center e-library.',
        'leadership', 'DILG Manila Sub-LG Resource Center (e-library copy)', DILG_MANILA_SK, OPS[0], OPS[1], year=2023,
        tags='SK,operations manual,sangguniang kabataan,training', material='handbook', featured=True,
        note='Check with the NYC or your DILG office for the latest edition.'),
    pdf('Handbook on the Financial Transaction of the Sangguniang Kabataan',
        'A handbook on the financial transactions of the Sangguniang Kabataan, listed in the SK Manual section of the DILG Manila '
        'Sub-LG Resource Center e-library.',
        'leadership', 'DILG Manila Sub-LG Resource Center (e-library copy)', DILG_MANILA_SK, HANDBOOK[0], HANDBOOK[1],
        tags='SK,financial transactions,accountability,budget,handbook', material='handbook', featured=True),
    pdf('Philippine Youth Development Plan 2023-2028 (Technical Copy)',
        'The Philippine Youth Development Plan for 2023 to 2028, listed as the "Technical Copy" on the National Youth Commission '
        'Downloadables page.',
        'leadership', 'National Youth Commission (NYC)', NYC_DOWNLOADS, PYDP[0], PYDP[1],
        tags='PYDP,youth development,national plan,NYC', material='pdf', featured=True),
    pdf('YORP Hub Manual (for YORP Members)',
        'Manual for YORP members, listed on the NYC Downloadables page together with the "YORP Hub Website Application (for '
        'Organization Members)".',
        'leadership', 'National Youth Commission (NYC)', NYC_DOWNLOADS, YORP_MEMBERS[0], YORP_MEMBERS[1],
        tags='YORP,youth organization,registration,manual', material='handbook', note=NYC_NOTE),
    pdf('YORP Panel Manual (for LYDOs)',
        'Manual for LYDOs on the YORP Panel, listed on the NYC Downloadables page together with the "YORP Hub Website Application '
        '(for Secretariat, Area Officers, and LYDOs)".',
        'leadership', 'National Youth Commission (NYC)', NYC_DOWNLOADS, YORP_LYDO[0], YORP_LYDO[1],
        tags='YORP,LYDO,youth organization,manual', material='handbook', note=NYC_NOTE),
    pdf('YORP Hub System Manual for Submission of Annual Accomplishment Report',
        'Manual for submitting the annual accomplishment report in the YORP Hub, listed on the NYC Downloadables page.',
        'leadership', 'National Youth Commission (NYC)', NYC_DOWNLOADS, YORP_ANNUAL[0], YORP_ANNUAL[1],
        tags='YORP,annual report,accomplishment report,youth organization', material='handbook', note=NYC_NOTE),
    pdf('YORP Panel System Manual for SGLG Certification',
        'Manual listed on the NYC Downloadables page as the "YORP Panel System Manual for SGLG Certification".',
        'leadership', 'National Youth Commission (NYC)', NYC_DOWNLOADS, YORP_SGLG[0], YORP_SGLG[1],
        tags='YORP,SGLG,certification,manual', material='handbook', note=NYC_NOTE),
    pdf('YORP Frequently Asked Questions (FAQs) Digital Brochure',
        'Digital brochure of frequently asked questions about YORP, listed on the NYC Downloadables page.',
        'leadership', 'National Youth Commission (NYC)', NYC_DOWNLOADS, YORP_FAQ[0], YORP_FAQ[1],
        tags='YORP,FAQ,youth organization,registration', material='guide', note=NYC_NOTE),

    # ── GOVERNANCE, FINANCIAL, LEGAL ──────────────────────────────────────────
    pdf('DBM-DILG-NYC Joint Memorandum Circular No. 1, s. 2025',
        'Prescribes the updated guidelines on the appropriation and release of the SK fund, in view of RA 11768. It also covers the '
        'planning and budgeting process, the Comprehensive Barangay Youth Development Plan (CBYDP) and posting requirements.',
        'governance', 'DBM, DILG and NYC', DBM, DBM + '2025/Joint-Memorandum-Circular/DBM-DILG-NYC-JOINT-MEMORANDUM-CIRCULAR-(JMC)-NO.-1-DATED-MAY-23,-2025.pdf',
        year=2025, tags='SK fund,budget,CBYDP,JMC,planning', law='JMC No. 1, s. 2025', featured=True,
        note='Dated May 23, 2025.'),
    pdf('DBM-DILG-NYC Joint Memorandum Circular No. 1, s. 2019',
        'Guidelines on the appropriation, release, planning and budgeting process for the SK funds.',
        'governance', 'DBM, DILG and NYC', DBM,
        'http://dbm.gov.ph/wp-content/uploads/Issuances/2019/Joint-Memorandum-Circular/DBM-DILG-NYC-JOINT-MEMORANDUM-CIRCULAR-NO-2019-1.pdf',
        year=2019, tags='SK fund,budget,JMC,planning', law='JMC No. 1, s. 2019',
        note='Dated January 23, 2019. See JMC No. 1, s. 2025 for the updated guidelines.'),
    pdf('TESDA Competency Standards: Bookkeeping for Sangguniang Kabataan (SK) Financial Transactions, Level II',
        'TESDA competency standards for "Bookkeeping for Sangguniang Kabataan (SK) Financial Transactions, Level II", under the '
        'Social and Other Community Development Services Sector.',
        'financial', 'Technical Education and Skills Development Authority (TESDA)', 'https://www.tesda.gov.ph/', TESDA_CS,
        tags='SK,bookkeeping,TESDA,financial management,competency standards', material='pdf'),
    pdf('Republic Act No. 11768: Strengthening the Sangguniang Kabataan',
        'Full title: "An Act Strengthening the Sangguniang Kabataan, Institutionalizing Additional Reforms to Revitalize Youth '
        'Participation in Local Governance and by Providing Honorarium, Other Benefits, and Privileges, Amending for the Purpose '
        'Certain Sections of Republic Act No. 10742". Dated May 6, 2022. The text is hosted by the Lawphil Project, a legal library.',
        'legal', 'Lawphil Project (Arellano Law Foundation)', 'https://lawphil.net/statutes/repacts/ra2022/ra_11768_2022.html',
        'https://lawphil.net/statutes/repacts/ra2022/ra_11768_2022.html', kind='other', law='RA 11768', year=2022,
        tags='SK,sangguniang kabataan,RA 11768,SK reform', material='article'),

    # ── EDUCATION ─────────────────────────────────────────────────────────────
    site('DepEd Learning Portal (LR Portal)',
         'DepEd\'s learning portal. Its menu lists K to 12 Resources, Alternative Learning System and Professional Development, with '
         'filters by title, keyword and competency.',
         'education', 'Department of Education (DepEd)', 'https://lrmds.deped.gov.ph/',
         tags='DepEd,K to 12,learning resources,alternative learning system', material='learning'),
    site('STARBOOKS (Science and Technology Academic and Research-Based Openly Operated KioskS)',
         'Website of STARBOOKS. Its menu lists About, News, Activities, Publications and Partners.',
         'education', 'STARBOOKS', 'https://starbooks.ph/', kind='other',
         tags='STARBOOKS,science,technology,digital library,learning', material='learning'),
    site('DOST Science Education Institute (DOST-SEI)',
         'Website of the Science Education Institute under the Department of Science and Technology.',
         'education', 'DOST Science Education Institute (DOST-SEI)', 'https://www.sei.dost.gov.ph/',
         tags='DOST-SEI,scholarship,science education,STEM'),
    site('UniFAST: Unified Student Financial Assistance System',
         'Website of UniFAST. Its menu lists Free Higher Education, Tertiary Education Subsidy, Student Loan Program and Free '
         'Tech-Voc, among other programs.',
         'education', 'UniFAST Board', 'https://unifast.gov.ph/',
         tags='UniFAST,free higher education,tertiary education subsidy,student loan,scholarship'),
    site('TESDA: Technical Education and Skills Development Authority',
         'TESDA provides direction, policies, programs and standards towards quality technical education and skills development. '
         'Its menu lists TVET Programs and Competency Standards.',
         'education', 'Technical Education and Skills Development Authority (TESDA)', 'https://www.tesda.gov.ph/',
         tags='TESDA,TVET,skills training,tech-voc,competency standards'),

    # ── OTHER: health, finance, digital, environment, career ─────────────────
    site('Mental health of adolescents (WHO fact sheet)',
         'World Health Organization fact sheet. It begins: "Adolescence (10-19 years) is a unique and formative time."',
         'other', 'World Health Organization (WHO)', 'https://www.who.int/news-room/fact-sheets/detail/adolescent-mental-health',
         kind='international', tags='mental health,adolescents,wellness,WHO', material='article'),
    site('UNICEF Philippines',
         "UNICEF's Philippines country website. Its sections include What we do, Research and reports, Stories and UNICEF Youth "
         'Advocates.',
         'other', 'UNICEF Philippines', 'https://www.unicef.org/philippines/', kind='international',
         tags='UNICEF,children,youth,health,education'),
    site('PDIC: Philippine Deposit Insurance Corporation',
         'Official website of the Philippine Deposit Insurance Corporation, a government instrumentality created in 1963. Its '
         'tagline is "Protecting your hard-earned money".',
         'financial', 'Philippine Deposit Insurance Corporation (PDIC)', 'https://www.pdic.gov.ph/',
         tags='savings,bank deposits,deposit insurance,financial literacy'),
    site('National Privacy Commission: Data Privacy Act (RA 10173)',
         "The National Privacy Commission's page on Republic Act 10173, the Data Privacy Act of 2012. The site menu also lists "
         '"30 Ways to Love Yourself Online" and "Privacy, Safety, Security & Trust Online (PSST)".',
         'other', 'National Privacy Commission (NPC)', 'https://privacy.gov.ph/data-privacy-act/',
         tags='data privacy,online safety,privacy,digital citizenship,NPC', material='article'),
    site('Republic Act No. 10175 (Cybercrime law)',
         'Full title: "An Act Defining Cybercrime, Providing for the Prevention, Investigation, Suppression and the Imposition of '
         'Penalties Therefor and for Other Purposes". Hosted by the Lawphil Project, a legal library.',
         'other', 'Lawphil Project (Arellano Law Foundation)', 'https://lawphil.net/statutes/repacts/ra2012/ra_10175_2012.html',
         kind='other', tags='cybercrime,cybersecurity,online safety,RA 10175', material='article'),
    site('Climate Change Commission',
         'Official website of the Climate Change Commission. Its menu lists Our Programs, Knowledge, Climate Change Projections and '
         'Climate Action.',
         'other', 'Climate Change Commission (CCC)', 'https://climate.gov.ph/',
         tags='climate change,environment,climate action,sustainability'),
    site('PAGASA',
         'Official website of PAGASA. Its menu lists the daily weather forecast, weather outlook and weather advisories.',
         'other', 'DOST-PAGASA', 'https://www.pagasa.dost.gov.ph/',
         tags='weather,typhoon,disaster preparedness,climate'),
    site('PHIVOLCS',
         'Official website of PHIVOLCS, under the Department of Science and Technology.',
         'other', 'DOST-PHIVOLCS', 'https://www.phivolcs.dost.gov.ph/',
         tags='earthquake,volcano,disaster preparedness,hazards'),
    site('Project NOAH (Nationwide Operational Assessment of Hazards)',
         'Web application of Project NOAH. It needs JavaScript to open.',
         'other', 'Project NOAH', 'https://noah.up.edu.ph/', kind='institution',
         tags='hazards,flood,disaster preparedness,NOAH'),
    site('DTI Negosyo Center',
         'Your gateway to entrepreneurship. Access DTI Negosyo Center services, resources, and expert guidance to start or grow your '
         'business.',
         'other', 'Department of Trade and Industry (DTI)', 'https://negosyocenter.dti.gov.ph/',
         tags='entrepreneurship,livelihood,business,DTI,negosyo'),
    site('Civil Service Commission',
         'Official website of the Philippines Civil Service Commission.',
         'other', 'Civil Service Commission (CSC)', 'https://www.csc.gov.ph/',
         tags='government jobs,civil service,career,employment'),
]


# Links in older seed data that returned "404 Not Found" when checked. The record is kept; a dead link is
# replaced only when a working official copy was found, otherwise it is cleared and a note is shown.
# Matching is by the exact old URL, so a link an admin has already fixed is never overwritten.
REPAIRS = [
    ('https://www.dilg.gov.ph/PDF_File/reports_resources/dilg-reports_resources-2016526-92b521a77c.pdf', '',
     'The original link stopped working. The current official copy is being located.'),
    ('https://www.dilg.gov.ph/PDF_File/issuances/mc/dilg-issuances-2016915-f00e4a4f31.pdf', '',
     'The original link stopped working. The current official copy is being located.'),
    ('https://nyc.gov.ph/phocadownload/publications/PYDP%202017-2022.pdf', '',
     'The original link stopped working. See the Philippine Youth Development Plan 2023-2028.'),
    ('https://www.dilg.gov.ph/PDF_File/issuances/mc/DILG_NYC-JMC-2016-01.pdf', '',
     'The original link stopped working. The current official copy is being located.'),
    ('https://www.officialgazette.gov.ph/2019/04/11/republic-act-no-11261/',
     'https://lawphil.net/statutes/repacts/ra2019/ra_11261_2019.html',
     'The Official Gazette link stopped working. The text is now linked from the Lawphil Project, a legal library.'),
]


class Command(BaseCommand):
    help = 'Add or update the verified Education, Leadership, Governance and Other library materials.'

    def handle(self, *args, **opts):
        fixed = 0
        for old, new, note in REPAIRS:
            fixed += Resource.objects.filter(external_url=old).update(
                external_url=new, source_url=new, status_note=note, verified_on=VERIFIED_ON,
            )
        if fixed:
            self.stdout.write(f'{fixed} dead link(s) repaired or flagged.')

        created = updated = 0
        for data in RESOURCES:
            existing = (
                Resource.objects.filter(external_url=data['external_url']).first()
                or Resource.objects.filter(title__iexact=data['title']).first()
            )
            obj = existing or Resource()
            for key, value in data.items():
                setattr(obj, key, value)
            obj.verified_on = VERIFIED_ON
            obj.is_published = True
            obj.save()
            created += 0 if existing else 1
            updated += 1 if existing else 0
        self.stdout.write(self.style.SUCCESS(f'{created} added, {updated} updated ({len(RESOURCES)} verified resources).'))
