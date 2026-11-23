from django.core.management.base import BaseCommand

from apps.resources.models import Scholarship

# Demonstration records only. No invented deadlines, amounts, partnerships or official rules.
SAMPLES = [
    dict(
        title='CHED UniFAST Scholarship', provider='CHED UniFAST', provider_type='government', category='tuition',
        description='Financial assistance for eligible Filipino college students pursuing higher education.',
        coverage='Tuition and other educational assistance, depending on the applicable program',
        eligibility=["Must meet the scholarship program's official qualifications."],
        required_documents=['valid_id', 'residency', 'enrollment', 'grades', 'id_picture'],
        optional_documents=['income_proof', 'other'], requires_gwa=True,
    ),
    dict(
        title='DOST-SEI Undergraduate Scholarship', provider='DOST-SEI', provider_type='government', category='stem',
        description='Financial assistance for qualified students pursuing priority science and technology degree programs.',
        coverage='Tuition, monthly stipend, and other benefits depending on the scholarship category',
        eligibility=['Must satisfy the official DOST-SEI qualifications and examination requirements.'],
        required_documents=['valid_id', 'birth_certificate', 'grades', 'id_picture'],
        optional_documents=['enrollment', 'other'], requires_gwa=True,
    ),
    dict(
        title='Lucena City Educational Assistance Program', provider='Lucena City Government',
        provider_type='local_government', category='assistance',
        description='Educational assistance for qualified residents of Lucena City who need financial support for their studies.',
        coverage="Subject to the local government's approved educational assistance program",
        eligibility=["Must be a qualified resident of Lucena City and meet the program's requirements."],
        required_documents=['valid_id', 'residency', 'indigency', 'enrollment', 'id_picture'],
        optional_documents=['grades', 'income_proof', 'other'], requires_gwa=False,
    ),
    dict(
        title='Private Educational Scholarship', provider='Sponsoring organization', provider_type='private', category='private',
        description='Financial assistance offered by private organizations or educational institutions to deserving students.',
        coverage='Depends on the sponsoring organization',
        eligibility=["Based on the sponsor's qualifications."],
        required_documents=['valid_id', 'enrollment', 'grades'],
        optional_documents=['income_proof', 'id_picture', 'other'], requires_gwa=True,
    ),
    dict(
        title='TESDA Technical-Vocational Scholarship', provider='TESDA', provider_type='government', category='vocational',
        description='Training support for qualified individuals who want to take a technical-vocational course.',
        coverage='Training costs and other support, depending on the program',
        eligibility=["Must meet the program's official qualifications."],
        required_documents=['valid_id', 'residency', 'birth_certificate', 'id_picture'],
        optional_documents=['grades', 'other'], requires_gwa=False,
    ),
    dict(
        title='Youth Leadership Grant', provider='Sponsoring organization', provider_type='ngo', category='youth_leadership',
        description='Support for young leaders who take part in community and youth development work.',
        coverage='Depends on the sponsoring organization',
        eligibility=["Based on the sponsor's qualifications."],
        required_documents=['valid_id', 'residency', 'enrollment', 'id_picture'],
        optional_documents=['grades', 'other'], requires_gwa=False,
    ),
    dict(
        title='Board Exam Review Assistance', provider='Sponsoring organization', provider_type='ngo', category='board_exam',
        description='Help for graduates who are preparing to take a professional board examination.',
        coverage='Review fees or materials, depending on the sponsor',
        eligibility=["Based on the sponsor's qualifications."],
        required_documents=['valid_id', 'grades', 'id_picture'],
        optional_documents=['income_proof', 'other'], requires_gwa=True,
    ),
    dict(
        title='Student Educational Loan Program', provider='Lending institution', provider_type='government', category='loan',
        description='A low-interest educational loan for students who need to finance their studies.',
        coverage='Loan terms depend on the lending institution',
        eligibility=["Must meet the lender's qualifications."],
        required_documents=['valid_id', 'enrollment', 'income_proof', 'id_picture'],
        optional_documents=['other'], requires_gwa=False,
    ),
]


class Command(BaseCommand):
    help = 'Create or update the four sample scholarships (marked as sample data). Safe to run again.'

    def handle(self, *args, **opts):
        for s in SAMPLES:
            obj = Scholarship.objects.filter(title__iexact=s['title']).first() or Scholarship(title=s['title'])
            for k, v in s.items():
                setattr(obj, k, v)
            if not obj.pk:
                obj.amount = 'To be announced'
                obj.slots = 'To be announced'
            obj.instructions = ('Sample record for system demonstration. Complete the application form, upload the required '
                                'documents, review everything, then submit. Keep your reference number to track the result.')
            obj.is_sample = True
            obj.is_published = True
            obj.accepting_applications = True
            obj.save()
            self.stdout.write(f'  {obj.title}')
        self.stdout.write(self.style.SUCCESS('Sample scholarships ready.'))
