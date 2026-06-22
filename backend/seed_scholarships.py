"""
Run: python seed_scholarships.py
Seeds the 10 scholarship listings previously in frontend/src/data/scholarships.ts.
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.resources.models import Scholarship  # noqa: E402

SCHOLARSHIPS = [
    {
        'title': 'CHED Unified Student Financial Assistance System (UniFAST)',
        'provider': 'Commission on Higher Education (CHED)',
        'provider_type': 'government',
        'coverage': 'Full tuition + living allowance',
        'amount': 'Up to PHP 60,000/year',
        'deadline': '2026-06-30',
        'slots': 'Nationwide',
        'description': (
            'The Unified Student Financial Assistance System provides grants, loans, and scholarships '
            'to qualified Filipino students under RA 10931 (Free Higher Education Act). Covers tuition, '
            'miscellaneous fees, and provides stipends for living expenses.'
        ),
        'requirements': [
            'Filipino citizen enrolled in any CHED-supervised institution',
            'Must not be a recipient of another government scholarship',
            'Family income not exceeding PHP 400,000/year',
            'Must be a regular student with satisfactory academic performance',
        ],
        'application_url': 'https://unifast.ched.gov.ph/',
        'is_featured': True,
        'category': 'tuition',
    },
    {
        'title': 'DOST-SEI Science and Technology Scholarship',
        'provider': 'Department of Science and Technology (DOST)',
        'provider_type': 'government',
        'coverage': 'Tuition + allowances',
        'amount': 'PHP 7,000/month allowance + tuition',
        'deadline': '2026-04-15',
        'slots': '3,000 slots/year',
        'description': (
            'The DOST Science and Technology scholarship supports students pursuing S&T-related courses. '
            'Scholars receive monthly stipend, book allowance, and tuition coverage at any CHED-accredited institution.'
        ),
        'requirements': [
            'Must be a high school graduate with honors or equivalent',
            'Must enroll in BS programs in Science, Technology, Engineering, or Mathematics (STEM)',
            'Family income must not exceed PHP 200,000/year',
            'Must pass DOST-SEI qualifying examination',
        ],
        'application_url': 'https://www.sei.dost.gov.ph/index.php/programs-and-projects/scholarships',
        'is_featured': True,
        'category': 'stem',
    },
    {
        'title': 'Lucena City Government Scholarship Program',
        'provider': 'City Government of Lucena',
        'provider_type': 'local_government',
        'coverage': 'Partial to full tuition',
        'amount': 'Up to PHP 30,000/semester',
        'deadline': '2026-07-31',
        'slots': '200 slots (Lucena City residents only)',
        'description': (
            'The Lucena City Scholarship Program provides educational assistance to qualified residents '
            'pursuing college degrees. Priority given to graduating seniors, orphans, solo parents, and '
            'students from low-income households. Renewable for up to 4 years.'
        ),
        'requirements': [
            'Must be a bonafide resident of Lucena City for at least 1 year',
            'Family income not exceeding PHP 150,000/year',
            'Must be enrolled or accepted to a degree program',
            'Must maintain a GWA of at least 2.0 to retain scholarship',
            'Must render 60 hours of community service per year',
        ],
        'application_url': '',
        'is_featured': True,
        'category': 'tuition',
    },
    {
        'title': 'SK Youth Leaders Scholarship Grant',
        'provider': 'Lucena City Youth Development Office (LYDO)',
        'provider_type': 'local_government',
        'coverage': 'Tuition assistance',
        'amount': 'PHP 15,000/semester',
        'deadline': '2026-08-15',
        'slots': '50 slots',
        'description': (
            'Exclusive scholarship grant for active SK officials and youth leaders in Lucena City. '
            'Supports youth leaders who balance academic and governance responsibilities. Must be an '
            'active SK officer or recognized youth leader during application.'
        ),
        'requirements': [
            'Must be an active SK official (Chairman, Kagawad, Secretary, or Treasurer)',
            'Or be a recognized youth org officer with at least 1 year of active service',
            'Currently enrolled or accepted to a college degree program',
            'Must maintain GWA of 2.25 and good standing in SK duties',
        ],
        'application_url': '',
        'is_featured': True,
        'category': 'youth_leadership',
    },
    {
        'title': 'TESDA Scholarship (TWSP / PESFA)',
        'provider': 'Technical Education and Skills Development Authority (TESDA)',
        'provider_type': 'government',
        'coverage': 'Full training cost',
        'amount': 'Training voucher (varies per program)',
        'deadline': 'Rolling',
        'slots': 'Nationwide — ongoing',
        'description': (
            'TESDA provides free technical-vocational training through the Training for Work Scholarship '
            'Program (TWSP) and Private Education Student Financial Assistance (PESFA). Programs available '
            'in IT, automotive, cooking, welding, caregiving, and more.'
        ),
        'requirements': [
            'Filipino citizen, priority for out-of-school youth and displaced workers',
            'Must enroll in a TESDA-accredited training center',
            'No age limit for most programs',
        ],
        'application_url': 'https://www.tesda.gov.ph/scholarship',
        'is_featured': False,
        'category': 'vocational',
    },
    {
        'title': 'GSIS Educational Assistance Loan (EAL)',
        'provider': 'Government Service Insurance System (GSIS)',
        'provider_type': 'government',
        'coverage': 'Educational loan for GSIS member dependents',
        'amount': 'Up to PHP 10,000/semester',
        'deadline': 'Per semester',
        'slots': 'GSIS members only',
        'description': (
            'The GSIS Educational Assistance Loan is available to qualified GSIS members and their dependents '
            'pursuing college or vocational education. Low-interest loan with flexible repayment terms '
            'deducted from monthly salary.'
        ),
        'requirements': [
            'Parent/guardian must be an active GSIS member',
            'Must be enrolled in a recognized school',
            'GSIS member must have at least 3 years of service',
        ],
        'application_url': 'https://www.gsis.gov.ph/members/loan/educational-assistance-loan/',
        'is_featured': False,
        'category': 'loan',
    },
    {
        'title': 'SM Foundation College Scholarship',
        'provider': 'SM Foundation Inc.',
        'provider_type': 'private',
        'coverage': 'Full scholarship',
        'amount': 'Full tuition + PHP 3,000/month allowance',
        'deadline': '2026-03-31',
        'slots': '150 slots/year (Nationwide)',
        'description': (
            'SM Foundation provides full college scholarships to deserving Filipino youth, with priority '
            'for students in business, engineering, nursing, and IT. Scholars benefit from SM Store '
            'privileges, OJT opportunities, and mentorship programs.'
        ),
        'requirements': [
            'Must be a high school graduate with at least 85% average',
            'Family income not exceeding PHP 144,000/year',
            'Must be accepted in SM Foundation partner schools',
            'Must be willing to render 120 hours of volunteer service/year',
        ],
        'application_url': 'https://www.smfoundation.org/pages/scholarship',
        'is_featured': False,
        'category': 'private',
    },
    {
        'title': 'PCSO Individual Medical Assistance Program (IMAP)',
        'provider': 'Philippine Charity Sweepstakes Office (PCSO)',
        'provider_type': 'government',
        'coverage': 'Medical/educational assistance',
        'amount': 'Up to PHP 50,000 (medical) / PHP 5,000 (educational)',
        'deadline': 'Rolling — anytime',
        'slots': 'Nationwide',
        'description': (
            'While primarily a medical assistance program, PCSO also offers educational assistance for '
            'indigent students who cannot afford school-related expenses. Applications can be filed '
            'directly at PCSO offices.'
        ),
        'requirements': [
            'Must be an indigent student',
            'Must submit barangay indigency certificate',
            'Must have a referral from a local government official or DSWD',
        ],
        'application_url': 'https://www.pcso.gov.ph/CharityPrograms/Charity',
        'is_featured': False,
        'category': 'assistance',
    },
    {
        'title': 'Quezon Province Scholarship (PSWDO)',
        'provider': 'Quezon Province Social Welfare Office',
        'provider_type': 'local_government',
        'coverage': 'Partial tuition assistance',
        'amount': 'PHP 5,000-10,000/semester',
        'deadline': '2026-06-15',
        'slots': 'Province-wide',
        'description': (
            'The Quezon Province Social Welfare and Development Office offers scholarship grants to qualified '
            'residents of Quezon Province, including Lucena City. Applicants must coordinate with their '
            'Barangay Social Worker for endorsement.'
        ),
        'requirements': [
            'Must be a resident of Quezon Province for at least 2 years',
            'Family income must not exceed PHP 120,000/year',
            'Must be currently enrolled or incoming freshman',
            'Must maintain satisfactory academic standing',
        ],
        'application_url': '',
        'is_featured': False,
        'category': 'tuition',
    },
    {
        'title': 'NYC Board Exam Review Assistance',
        'provider': 'National Youth Commission (NYC)',
        'provider_type': 'government',
        'coverage': 'Board exam review subsidy',
        'amount': 'Up to PHP 8,000 per reviewer',
        'deadline': 'Per batch',
        'slots': 'Limited — first come first served',
        'description': (
            'NYC provides review assistance for qualifying youth who are preparing for board examinations. '
            'Covers registration fees for accredited review centers. Available for professions including '
            'nursing, engineering, accounting, and education.'
        ),
        'requirements': [
            'Must be a Filipino youth (18-30 years old)',
            'Must be a graduating student or recent graduate eligible to take board exams',
            'Must submit letter of intent and income documents',
        ],
        'application_url': 'https://nyc.gov.ph/',
        'is_featured': False,
        'category': 'board_exam',
    },
]


def run():
    created = 0
    skipped = 0
    for data in SCHOLARSHIPS:
        _, was_created = Scholarship.objects.get_or_create(
            title=data['title'],
            defaults=data,
        )
        if was_created:
            created += 1
        else:
            skipped += 1

    print(f'Done — {created} created, {skipped} already existed.')


if __name__ == '__main__':
    run()
