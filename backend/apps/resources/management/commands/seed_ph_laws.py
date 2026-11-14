"""Replace the law/policy resources with a clean, deduplicated list of Philippine
laws that govern or benefit SK officials, youth organization leaders and the
general youth. Idempotent. Links use the lawphil.net statute pattern; please
spot-check them and the summaries before relying on them.

    python manage.py seed_ph_laws
"""
from django.core.management.base import BaseCommand

from apps.resources.models import Resource

SK, ORG, YOUTH = 'SK officials', 'youth organization leaders', 'general youth'

# (number, year, title, category, audience, summary)
LAWS = [
    # --- Core SK / youth governance ---
    (10742, 2016, 'Sangguniang Kabataan Reform Act of 2015', 'governance', [SK, ORG, YOUTH],
     'Defines youth as ages 15-30 and SK officials as 18-24 at election. Each barangay SK has a Chairperson and 7 Kagawad; the Secretary and Treasurer are appointed. Three-year term. Requires the Katipunan ng Kabataan, the Comprehensive Barangay Youth Development Plan (CBYDP) and Annual Barangay Youth Investment Program (ABYIP), the Local Youth Development Council, mandatory SK training, and a 10% share of the barangay general fund. Bars relatives of incumbent elected officials within the second degree (anti-dynasty).'),
    (8044, 1995, 'Youth in Nation-Building Act', 'governance', [SK, ORG, YOUTH],
     'Created the National Youth Commission, set the National Comprehensive and Coordinated Program on Youth Development, and recognises youth organizations as partners in nation building.'),
    (7160, 1991, 'Local Government Code of 1991', 'governance', [SK],
     'Basis of local autonomy. Defines barangay and Sangguniang Kabataan powers, local budgets and the participation of people\'s organizations and the youth in local special bodies.'),
    (11935, 2022, 'Act Postponing the December 2022 Barangay and SK Elections', 'governance', [SK],
     'Moved the Barangay and SK elections to the last Monday of October 2023 and extended the terms of incumbent barangay and SK officials until their successors took office.'),
    (11462, 2019, 'Act Postponing the May 2020 Barangay and SK Elections', 'governance', [SK],
     'Earlier postponement of the Barangay and SK elections; also set the transitional terms of incumbent officials.'),
    (9163, 2001, 'National Service Training Program (NSTP) Act of 2001', 'education', [YOUTH],
     'Requires NSTP (CWTS, LTS or ROTC) for tertiary students; aims to build civic consciousness and defense preparedness among the youth.'),
    # --- Accountability, finance and conduct ---
    (6713, 1989, 'Code of Conduct and Ethical Standards for Public Officials and Employees', 'governance', [SK],
     'Sets norms of conduct for all public officials, including SK officials: professionalism, honesty, simple living, SALN disclosure and conflict-of-interest rules.'),
    (3019, 1960, 'Anti-Graft and Corrupt Practices Act', 'legal', [SK],
     'Prohibits corrupt practices of public officers, including SK officials who handle public funds.'),
    (9184, 2003, 'Government Procurement Reform Act', 'financial', [SK],
     'Rules for procurement of goods and services with public funds, including SK funds; promotes transparency and competitive bidding.'),
    (11032, 2018, 'Ease of Doing Business and Efficient Government Service Delivery Act of 2018', 'governance', [SK, ORG],
     'Sets maximum processing times for government transactions and penalises fixers and red tape.'),
    (10121, 2010, 'Philippine Disaster Risk Reduction and Management Act of 2010', 'governance', [SK, ORG],
     'Establishes disaster risk reduction structures down to the barangay level; local DRRM funds and the role of youth volunteers.'),
    # --- Education ---
    (10533, 2013, 'Enhanced Basic Education Act of 2013 (K to 12)', 'education', [YOUTH],
     'Adds kindergarten and Senior High School, making basic education 13 years.'),
    (10931, 2017, 'Universal Access to Quality Tertiary Education Act', 'education', [YOUTH],
     'Free tuition and other school fees in state universities and colleges and local universities and colleges, plus a tertiary education subsidy and student loan program.'),
    (7796, 1994, 'Technical Education and Skills Development Act of 1994', 'education', [YOUTH],
     'Created TESDA to manage technical-vocational education and training.'),
    (11230, 2019, 'Tulong Trabaho Act', 'education', [YOUTH],
     'Free technical-vocational training and skills upgrading programs matched to local job needs.'),
    (10627, 2013, 'Anti-Bullying Act of 2013', 'legal', [YOUTH],
     'Requires elementary and secondary schools to adopt anti-bullying policies and protect students from bullying.'),
    # --- Employment and livelihood ---
    (11261, 2019, 'First Time Jobseekers Assistance Act', 'legal', [YOUTH],
     'Waives government fees and documents for first-time jobseekers when getting pre-employment documents such as NBI clearance, police clearance and barangay certificate.'),
    (10679, 2015, 'Youth Entrepreneurship Act', 'financial', [YOUTH, ORG],
     'Promotes youth entrepreneurship through education, mentoring and access to financing and support programs.'),
    (10911, 2016, 'Anti-Age Discrimination in Employment Act', 'legal', [YOUTH],
     'Prohibits age-based discrimination in hiring, promotion and termination.'),
    # --- Protection, health and rights ---
    (7610, 1992, 'Special Protection of Children Against Abuse, Exploitation and Discrimination Act', 'legal', [YOUTH, SK, ORG],
     'Protects children (below 18) against abuse, exploitation and discrimination.'),
    (9344, 2006, 'Juvenile Justice and Welfare Act of 2006', 'legal', [YOUTH, SK],
     'Sets the system for children in conflict with the law, with emphasis on diversion and rehabilitation; barangay and Local Councils for the Protection of Children have a role.'),
    (10630, 2013, 'Act Strengthening the Juvenile Justice System (amends RA 9344)', 'legal', [YOUTH, SK],
     'Strengthens the juvenile justice system and the role of the Juvenile Justice and Welfare Council.'),
    (11596, 2021, 'Prohibition of Child Marriage Act', 'legal', [YOUTH],
     'Makes child marriage unlawful and penalises those who facilitate or solemnise it.'),
    (11930, 2022, 'Anti-Online Sexual Abuse or Exploitation of Children (OSAEC) Act', 'legal', [YOUTH, SK],
     'Penalises online sexual abuse and exploitation of children and the distribution of child sexual abuse materials.'),
    (11313, 2019, 'Safe Spaces Act (Bawal Bastos Law)', 'legal', [YOUTH, SK, ORG],
     'Penalises gender-based sexual harassment in streets, public spaces, workplaces, schools and online.'),
    (9262, 2004, 'Anti-Violence Against Women and Their Children Act', 'legal', [YOUTH, SK],
     'Protects women and children from physical, sexual, psychological and economic abuse; barangay protection orders.'),
    (10173, 2012, 'Data Privacy Act of 2012', 'legal', [YOUTH, SK, ORG],
     'Protects personal information in information and communications systems; consent and security duties for anyone who collects data, such as SK and youth organization records.'),
    (10175, 2012, 'Cybercrime Prevention Act of 2012', 'legal', [YOUTH],
     'Defines and penalises cybercrime offences such as illegal access, identity theft and online libel.'),
    (11036, 2018, 'Mental Health Act', 'health', [YOUTH, SK],
     'Guarantees access to mental health services and protects the rights of persons with mental health conditions; includes school and community mental health programs.'),
    (10354, 2012, 'Responsible Parenthood and Reproductive Health Act of 2012', 'health', [YOUTH],
     'Access to information and services on family planning, maternal health and adolescent reproductive health.'),
    (11166, 2018, 'Philippine HIV and AIDS Policy Act', 'health', [YOUTH],
     'Prevention, testing and treatment of HIV, with confidentiality protections for people living with HIV.'),
    (11223, 2019, 'Universal Health Care Act', 'health', [YOUTH],
     'Automatic PhilHealth coverage for all Filipinos and a unified health system.'),
    (9165, 2002, 'Comprehensive Dangerous Drugs Act of 2002', 'legal', [YOUTH, SK],
     'Defines drug offences and penalties; prevention education; Barangay Anti-Drug Abuse Councils (BADAC).'),
    (9003, 2000, 'Ecological Solid Waste Management Act of 2000', 'governance', [SK, ORG, YOUTH],
     'Requires barangay-level segregation and recycling (Materials Recovery Facility); a common field for youth environmental projects.'),
]

PLANS = [
    ('Philippine Youth Development Plan 2017-2022', 2017,
     'The national medium-term plan of the National Youth Commission that guided youth programs until 2022.'),
    ('Philippine Youth Development Plan 2023-2028', 2023,
     'The current national youth development plan of the National Youth Commission; SK and local youth plans should align with it.'),
]


class Command(BaseCommand):
    help = 'Replace law/policy resources with a clean list of Philippine laws for SK, youth organizations and youth.'

    def handle(self, *args, **opts):
        Resource.objects.filter(law_number__gt='').delete()
        Resource.objects.filter(title__icontains='Youth Development Plan').delete()
        for num, year, title, cat, aud, summary in LAWS:
            Resource.objects.create(
                title=f'Republic Act No. {num} - {title}',
                law_number=f'RA {num}',
                year_enacted=year,
                category=cat,
                resource_type='link',
                tags=', '.join(aud),
                description=summary + ' Applies to: ' + ', '.join(aud) + '.',
                external_url=f'https://lawphil.net/statutes/repacts/ra{year}/ra_{num}_{year}.html',
                is_published=True,
                is_featured=num in (10742, 8044),
            )
        for title, year, desc in PLANS:
            Resource.objects.create(
                title=title, year_enacted=year, category='governance', resource_type='link',
                tags=f'{SK}, {ORG}, {YOUTH}', description=desc,
                external_url='https://nyc.gov.ph/', is_published=True,
            )
        self.stdout.write(self.style.SUCCESS(f'{Resource.objects.count()} resources'))
