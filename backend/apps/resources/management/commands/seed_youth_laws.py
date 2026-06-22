"""
Management command: seed_youth_laws

Populates the Resource table with Philippine laws, policies, and government
materials relating to the youth, SK, and youth organizations.

Run:
    python manage.py seed_youth_laws
    python manage.py seed_youth_laws --clear   # wipe existing law seeds first
"""

from django.core.management.base import BaseCommand

from apps.resources.models import Resource

# ---------------------------------------------------------------------------
# Seed data — Philippine youth-related laws & government materials
# ---------------------------------------------------------------------------

RESOURCES = [
    # â”€â”€ SK-specific â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    {
        'title': 'Sangguniang Kabataan Reform Act of 2015',
        'law_number': 'RA 10742',
        'year_enacted': 2016,
        'category': 'legal',
        'resource_type': 'link',
        'tags': 'SK,sangguniang kabataan,reform,local governance',
        'is_featured': True,
        'description': (
            'The landmark law that reformed the Sangguniang Kabataan (SK) by raising '
            'membership age, strengthening fiscal accountability, and establishing '
            'the Annual Katipunan ng Kabataan (AKK). It sets the legal framework for '
            'all SK elections, budgets, and programs at the barangay level.'
        ),
        'external_url': 'https://www.officialgazette.gov.ph/2016/01/08/republic-act-no-10742/',
    },
    {
        'title': 'Implementing Rules and Regulations of RA 10742',
        'law_number': 'IRR of RA 10742',
        'year_enacted': 2016,
        'category': 'governance',
        'resource_type': 'link',
        'tags': 'SK,IRR,implementation,DILG',
        'is_featured': False,
        'description': (
            'The joint DILG-NYC-COMELEC implementing rules covering SK election '
            'procedures, budget allocation rules, term limits, and the creation of '
            'the Sangguniang Kabataan Federation at municipal, city, provincial, and '
            'national levels.'
        ),
        'external_url': 'https://www.dilg.gov.ph/PDF_File/reports_resources/dilg-reports_resources-2016526-92b521a77c.pdf',
    },
    {
        'title': 'SK Financial Audit Guidelines — COA Circular 2020-001',
        'law_number': 'COA Circular 2020-001',
        'year_enacted': 2020,
        'category': 'financial',
        'resource_type': 'link',
        'tags': 'SK,COA,audit,financial accountability,budget',
        'is_featured': False,
        'description': (
            'Commission on Audit circular providing revised rules and procedures for '
            'the audit of Sangguniang Kabataan funds, including the SK Special Fund, '
            'Youth Development Fund, and AKYAT (Annual Katipunan ng Kabataan) allocations.'
        ),
        'external_url': 'https://www.coa.gov.ph/phocadownload/Issuances/CircularsAndMemorandums/2020/COA_Circular_2020-001.pdf',
    },
    {
        'title': 'DILG Memorandum Circular 2016-136 — SK Orientation',
        'law_number': 'DILG MC 2016-136',
        'year_enacted': 2016,
        'category': 'governance',
        'resource_type': 'link',
        'tags': 'SK,DILG,orientation,capacity building',
        'is_featured': False,
        'description': (
            'DILG circular requiring mandatory orientation for newly elected SK '
            'officials on their roles, responsibilities, financial management, '
            'program planning, and the conduct of the Annual Katipunan ng Kabataan.'
        ),
        'external_url': 'https://www.dilg.gov.ph/PDF_File/issuances/mc/dilg-issuances-2016915-f00e4a4f31.pdf',
    },

    # â”€â”€ National Youth Policy â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    {
        'title': 'Youth in Nation-Building Act',
        'law_number': 'RA 8044',
        'year_enacted': 1995,
        'category': 'legal',
        'resource_type': 'link',
        'tags': 'NYC,youth policy,nation building,National Youth Commission',
        'is_featured': True,
        'description': (
            'Established the National Youth Commission (NYC) as the lead government '
            'agency for youth affairs. Mandates the formulation and coordination of '
            'policies, programs, and projects for the youth sector, and created the '
            'Philippine Youth Development Plan (PYDP).'
        ),
        'external_url': 'https://www.officialgazette.gov.ph/1995/06/07/republic-act-no-8044/',
    },
    {
        'title': 'Amendments to the Youth in Nation-Building Act',
        'law_number': 'RA 10650',
        'year_enacted': 2014,
        'category': 'legal',
        'resource_type': 'link',
        'tags': 'NYC,National Youth Commission,youth policy,amendment',
        'is_featured': False,
        'description': (
            'Amended RA 8044 to strengthen the National Youth Commission, expand its '
            'mandate and coverage, and improve the governance structure for youth '
            'development programs at the national and local levels.'
        ),
        'external_url': 'https://www.officialgazette.gov.ph/2014/11/07/republic-act-no-10650/',
    },
    {
        'title': 'National Youth Development Policy — NYC Resolution 2020-01',
        'law_number': 'NYC Resolution 2020-01',
        'year_enacted': 2020,
        'category': 'governance',
        'resource_type': 'link',
        'tags': 'NYC,youth development,policy,resolution',
        'is_featured': True,
        'description': (
            'The National Youth Commission resolution adopting the updated National '
            'Youth Development Policy (NYDP) aligned with AmBisyon Natin 2040 and '
            'the UN Sustainable Development Goals. Covers youth participation, '
            'empowerment, and the 10 priority areas of the NYC program agenda.'
        ),
        'external_url': 'https://nyc.gov.ph/programs/',
    },
    {
        'title': 'Philippine Youth Development Plan 2017â€“2022',
        'law_number': 'PYDP 2017â€“2022',
        'year_enacted': 2017,
        'category': 'governance',
        'resource_type': 'link',
        'tags': 'PYDP,youth development plan,NYC,strategic plan',
        'is_featured': False,
        'description': (
            'The medium-term plan outlining the government strategic framework for '
            'youth development across 10 thematic areas: education, health, employment, '
            'civic engagement, social inclusion, sports, the arts, science and technology, '
            'environment, and peace and security.'
        ),
        'external_url': 'https://nyc.gov.ph/phocadownload/publications/PYDP%202017-2022.pdf',
    },

    # â”€â”€ Juvenile Justice â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    {
        'title': 'Juvenile Justice and Welfare Act of 2006',
        'law_number': 'RA 9344',
        'year_enacted': 2006,
        'category': 'legal',
        'resource_type': 'link',
        'tags': 'juvenile justice,CICL,children in conflict,welfare,JJWA',
        'is_featured': True,
        'description': (
            'Established a comprehensive juvenile justice and welfare system that '
            'recognizes the rights of children in conflict with the law (CICL). '
            'Provides for diversion programs, intervention programs, and restorative '
            'justice mechanisms. Sets the minimum age of criminal responsibility at 15.'
        ),
        'external_url': 'https://www.officialgazette.gov.ph/2006/04/28/republic-act-no-9344/',
    },
    {
        'title': 'Juvenile Justice and Welfare Act — Amendment',
        'law_number': 'RA 10630',
        'year_enacted': 2013,
        'category': 'legal',
        'resource_type': 'link',
        'tags': 'juvenile justice,CICL,JJWA,amendment,BCPC',
        'is_featured': False,
        'description': (
            'Amended RA 9344 to strengthen the juvenile justice system by establishing '
            'Bahay Pag-asa (community-based intervention centers), clarifying rules on '
            'diversion, and improving provisions on children 15 years old or below '
            'found in conflict with the law.'
        ),
        'external_url': 'https://www.officialgazette.gov.ph/2013/10/03/republic-act-no-10630/',
    },

    # â”€â”€ Child Protection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    {
        'title': 'Special Protection of Children Against Child Abuse, Exploitation and Discrimination Act',
        'law_number': 'RA 7610',
        'year_enacted': 1992,
        'category': 'legal',
        'resource_type': 'link',
        'tags': 'child protection,abuse,exploitation,discrimination,DSWD',
        'is_featured': False,
        'description': (
            'Provides special protection to children against child abuse, exploitation, '
            'discrimination, and violence. Defines child abuse and prescribes penalties. '
            'Covers child labor, children in armed conflict, children in street situations, '
            'and children exploited in prostitution.'
        ),
        'external_url': 'https://www.officialgazette.gov.ph/1992/06/17/republic-act-no-7610/',
    },
    {
        'title': 'Anti-Violence Against Women and Their Children Act',
        'law_number': 'RA 9262',
        'year_enacted': 2004,
        'category': 'legal',
        'resource_type': 'link',
        'tags': 'VAWC,women,children,domestic violence,protection order',
        'is_featured': False,
        'description': (
            'Defines violence against women and their children (VAWC) and provides '
            'for protection orders, penalty provisions, and mandatory barangay-level '
            'response mechanisms. Young women and youth are primary beneficiaries of '
            'the protection this law provides.'
        ),
        'external_url': 'https://www.officialgazette.gov.ph/2004/03/08/republic-act-no-9262/',
    },
    {
        'title': 'Anti-Child Pornography Act of 2009',
        'law_number': 'RA 9775',
        'year_enacted': 2009,
        'category': 'legal',
        'resource_type': 'link',
        'tags': 'child pornography,online safety,exploitation,internet',
        'is_featured': False,
        'description': (
            'Penalizes child pornography, the use of children in obscene publications, '
            'and related online offenses. Critical for youth awareness programs on '
            'online safety, digital citizenship, and child protection online.'
        ),
        'external_url': 'https://www.officialgazette.gov.ph/2009/11/17/republic-act-no-9775/',
    },
    {
        'title': 'Safe Spaces Act (Bawal Bastos Law)',
        'law_number': 'RA 11313',
        'year_enacted': 2019,
        'category': 'legal',
        'resource_type': 'link',
        'tags': 'safe spaces,gender,harassment,bawal bastos,online harassment',
        'is_featured': False,
        'description': (
            'Expanded the coverage of Anti-Sexual Harassment Act to include gender-based '
            'harassment in streets, public spaces, online environments, workplaces, and '
            'educational institutions. Particularly relevant for youth programs on '
            'gender equality, safe spaces, and anti-harassment campaigns.'
        ),
        'external_url': 'https://www.officialgazette.gov.ph/2019/04/17/republic-act-no-11313/',
    },

    # â”€â”€ Anti-Hazing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    {
        'title': 'Anti-Hazing Act of 2018',
        'law_number': 'RA 11053',
        'year_enacted': 2018,
        'category': 'legal',
        'resource_type': 'link',
        'tags': 'anti-hazing,fraternities,sororities,organizations,student',
        'is_featured': False,
        'description': (
            'Repealed RA 8049 and strengthened anti-hazing provisions by expanding '
            'coverage, increasing penalties, holding officers and organizations '
            'liable, and requiring schools to establish anti-hazing committees. '
            'Directly applicable to school-based and community youth organizations.'
        ),
        'external_url': 'https://www.officialgazette.gov.ph/2018/06/29/republic-act-no-11053/',
    },

    # â”€â”€ Education & Scholarship â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    {
        'title': 'Universal Access to Quality Tertiary Education Act',
        'law_number': 'RA 10931',
        'year_enacted': 2017,
        'category': 'education',
        'resource_type': 'link',
        'tags': 'free tuition,SUC,LUC,tertiary education,college,scholarship',
        'is_featured': True,
        'description': (
            'Provides free tuition and other school fees in all State Universities '
            'and Colleges (SUCs), Local Universities and Colleges (LUCs), and '
            'technical-vocational institutions. Also establishes the Tertiary '
            'Education Subsidy (TES) for students in private HEIs.'
        ),
        'external_url': 'https://www.officialgazette.gov.ph/2017/08/03/republic-act-no-10931/',
    },
    {
        'title': 'Enhanced Basic Education Act of 2013 (K to 12)',
        'law_number': 'RA 10533',
        'year_enacted': 2013,
        'category': 'education',
        'resource_type': 'link',
        'tags': 'K-12,basic education,DepEd,senior high school,curriculum',
        'is_featured': False,
        'description': (
            'Established the K to 12 basic education system in the Philippines, '
            'adding Kindergarten and two years of Senior High School (Grades 11 and 12). '
            'Ensures graduates are equipped with skills for employment, '
            'entrepreneurship, or higher education.'
        ),
        'external_url': 'https://www.officialgazette.gov.ph/2013/05/15/republic-act-no-10533/',
    },
    {
        'title': 'Alternative Learning System Policy Act',
        'law_number': 'RA 11510',
        'year_enacted': 2020,
        'category': 'education',
        'resource_type': 'link',
        'tags': 'ALS,alternative learning,out-of-school youth,OSY,DepEd',
        'is_featured': False,
        'description': (
            'Institutionalizes the Alternative Learning System (ALS) to provide '
            'out-of-school youth and adults with a flexible learning pathway. '
            'Mandates government support for OSY (Out-of-School Youth) programs '
            'and equivalency certifications.'
        ),
        'external_url': 'https://www.officialgazette.gov.ph/2020/02/14/republic-act-no-11510/',
    },
    {
        'title': 'Technical Education and Skills Development Act',
        'law_number': 'RA 7796',
        'year_enacted': 1994,
        'category': 'education',
        'resource_type': 'link',
        'tags': 'TESDA,technical vocational,TVET,livelihood,skills training',
        'is_featured': False,
        'description': (
            'Created the Technical Education and Skills Development Authority (TESDA) '
            'to manage technical-vocational education and training (TVET) in the '
            'Philippines. Provides a framework for skills assessment, certification, '
            'and industry-based training programs accessible to youth.'
        ),
        'external_url': 'https://www.officialgazette.gov.ph/1994/08/25/republic-act-no-7796/',
    },

    # â”€â”€ Employment & Livelihood â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    {
        'title': 'First Time Jobseekers Assistance Act',
        'law_number': 'RA 11261',
        'year_enacted': 2019,
        'category': 'legal',
        'resource_type': 'link',
        'tags': 'first time jobseeker,employment,NBI,police clearance,free',
        'is_featured': False,
        'description': (
            'Grants first-time jobseekers exemption from payment of fees for NBI '
            'clearance, police clearance, barangay clearance, medical and birth '
            'certificates, and other government-required documents needed for '
            'employment. Valid for one year from date of graduation.'
        ),
        'external_url': 'https://www.officialgazette.gov.ph/2019/04/11/republic-act-no-11261/',
    },
    {
        'title': 'Expanded Solo Parents Welfare Act',
        'law_number': 'RA 11861',
        'year_enacted': 2022,
        'category': 'legal',
        'resource_type': 'link',
        'tags': 'solo parent,welfare,young parents,leave benefits,scholarship',
        'is_featured': False,
        'description': (
            'Expanded the Solo Parents Welfare Act of 2000 to broaden eligibility, '
            'increase monthly allowances, and extend benefits including educational '
            'scholarships, housing priority, and parental leave. Relevant for '
            'young solo parents in the youth sector.'
        ),
        'external_url': 'https://www.officialgazette.gov.ph/2022/08/09/republic-act-no-11861/',
    },
    {
        'title': 'Magna Carta for Workers in the Informal Economy',
        'law_number': 'RA 11641',
        'year_enacted': 2021,
        'category': 'legal',
        'resource_type': 'link',
        'tags': 'informal economy,workers,livelihood,social protection,youth worker',
        'is_featured': False,
        'description': (
            'Provides protection and benefits to workers in the informal economy — '
            'a category that includes many out-of-school youth and young workers. '
            'Establishes the Department of Migrant Workers integration with local '
            'livelihood programs and social protection.'
        ),
        'external_url': 'https://www.officialgazette.gov.ph/2021/12/30/republic-act-no-11641/',
    },

    # â”€â”€ Health â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    {
        'title': 'Adolescent and Youth Health Policy',
        'law_number': 'DOH AO 2019-0022',
        'year_enacted': 2019,
        'category': 'health',
        'resource_type': 'link',
        'tags': 'adolescent health,sexual health,mental health,DOH,reproductive health',
        'is_featured': False,
        'description': (
            'DOH Administrative Order establishing the Adolescent and Youth Health '
            'Policy to ensure comprehensive, rights-based, and youth-friendly health '
            'services for Filipinos aged 10â€“24. Covers reproductive health, '
            'mental health, nutrition, and substance abuse prevention.'
        ),
        'external_url': 'https://www.doh.gov.ph/sites/default/files/health_advisory/AO%202019-0022.pdf',
    },
    {
        'title': 'Comprehensive Dangerous Drugs Act of 2002',
        'law_number': 'RA 9165',
        'year_enacted': 2002,
        'category': 'health',
        'resource_type': 'link',
        'tags': 'drugs,anti-drug,PDEA,DDB,prevention,rehabilitation,youth',
        'is_featured': False,
        'description': (
            'The primary anti-drug law of the Philippines, covering prevention, '
            'education, rehabilitation, and law enforcement for dangerous drugs. '
            'Includes provisions for drug abuse prevention programs in schools '
            'and communities, directly impacting youth programs and advocacy.'
        ),
        'external_url': 'https://www.officialgazette.gov.ph/2002/06/07/republic-act-no-9165/',
    },
    {
        'title': 'Anti-Tobacco Products Regulation for Minors',
        'law_number': 'RA 11900',
        'year_enacted': 2022,
        'category': 'health',
        'resource_type': 'link',
        'tags': 'vaping,e-cigarette,tobacco,minors,youth,vape regulation',
        'is_featured': False,
        'description': (
            'Regulates the importation, sale, manufacture, and distribution of '
            'vaporized nicotine and non-nicotine products (vapes/e-cigarettes). '
            'Prohibits sale to persons below 18 years old and near schools. '
            'Critical for youth health advocacy programs.'
        ),
        'external_url': 'https://www.officialgazette.gov.ph/2022/07/25/republic-act-no-11900/',
    },
    {
        'title': 'Mental Health Act',
        'law_number': 'RA 11036',
        'year_enacted': 2018,
        'category': 'health',
        'resource_type': 'link',
        'tags': 'mental health,psychological wellbeing,counseling,school,suicide prevention',
        'is_featured': False,
        'description': (
            'Establishes a national mental health policy and requires mental health '
            'services in schools, workplaces, and communities. Mandates that all '
            'schools provide mental health programs and requires local government '
            'units to establish mental health centers. Highly relevant for youth '
            'wellness programs.'
        ),
        'external_url': 'https://www.officialgazette.gov.ph/2018/06/20/republic-act-no-11036/',
    },

    # â”€â”€ Rights & Civil â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    {
        'title': 'Data Privacy Act of 2012',
        'law_number': 'RA 10173',
        'year_enacted': 2012,
        'category': 'legal',
        'resource_type': 'link',
        'tags': 'data privacy,NPC,personal data,digital rights,online',
        'is_featured': False,
        'description': (
            'Protects individual personal information processed by the government '
            'and private sectors. Establishes the National Privacy Commission (NPC). '
            'Essential reading for youth programs involving data collection, '
            'social media, and digital platforms.'
        ),
        'external_url': 'https://www.officialgazette.gov.ph/2012/08/15/republic-act-no-10173/',
    },
    {
        'title': 'Anti-Bullying Act of 2013',
        'law_number': 'RA 10627',
        'year_enacted': 2013,
        'category': 'legal',
        'resource_type': 'link',
        'tags': 'anti-bullying,school,cyberbullying,students,child rights',
        'is_featured': False,
        'description': (
            'Requires all elementary and secondary schools to adopt policies to '
            'address bullying in school environments, including cyberbullying. '
            'Mandates mechanisms for reporting, investigating, and addressing '
            'bullying incidents and provides for student psychological support.'
        ),
        'external_url': 'https://www.officialgazette.gov.ph/2013/09/06/republic-act-no-10627/',
    },

    # â”€â”€ Environment â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    {
        'title': 'Ecological Solid Waste Management Act',
        'law_number': 'RA 9003',
        'year_enacted': 2001,
        'category': 'legal',
        'resource_type': 'link',
        'tags': 'solid waste,environment,recycling,barangay,ecological,youth ecology',
        'is_featured': False,
        'description': (
            'Provides the legal framework for ecological solid waste management in '
            'the Philippines. Requires barangays to implement waste segregation, '
            'composting, and recycling programs. Youth environmental programs on '
            'waste management are grounded in this law.'
        ),
        'external_url': 'https://www.officialgazette.gov.ph/2001/01/26/republic-act-no-9003/',
    },
    {
        'title': 'Youth Ecological Corps Act',
        'law_number': 'RA 10771',
        'year_enacted': 2015,
        'category': 'legal',
        'resource_type': 'link',
        'tags': 'ecology,environment,youth corps,tree planting,green jobs',
        'is_featured': False,
        'description': (
            'Established the Philippine Green Jobs Act which connects youth employment '
            'to environmental sustainability. Also, the National Youth Ecological Corps '
            'operationalized through various NYC programs to engage youth in tree '
            'planting, coastal clean-ups, and climate change advocacy.'
        ),
        'external_url': 'https://www.officialgazette.gov.ph/2015/07/21/republic-act-no-10771/',
    },

    # â”€â”€ Constitutional provisions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    {
        'title': '1987 Philippine Constitution — Youth Provisions',
        'law_number': 'Article II, XIV, XVII',
        'year_enacted': 1987,
        'category': 'legal',
        'resource_type': 'link',
        'tags': 'constitution,1987,Article II,Article XIV,youth,education,rights',
        'is_featured': True,
        'description': (
            'Key constitutional provisions affecting the youth: Art. II Sec. 13 '
            '(State shall promote youth participation in civic affairs), '
            'Art. XIV (education rights, academic freedom, free public education), '
            'and the Bill of Rights. The foundational document underpinning all '
            'youth laws and policies in the Philippines.'
        ),
        'external_url': 'https://www.officialgazette.gov.ph/constitutions/the-1987-constitution-of-the-republic-of-the-philippines/',
    },

    # â”€â”€ DILG Circulars & Guides â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    {
        'title': 'DILG Joint Memorandum Circular on LYDO',
        'law_number': 'DILG-NYC JMC 2016-01',
        'year_enacted': 2016,
        'category': 'governance',
        'resource_type': 'link',
        'tags': 'LYDO,Local Youth Development Office,LGU,youth office,DILG',
        'is_featured': False,
        'description': (
            'Joint circular of DILG and the National Youth Commission prescribing '
            'the guidelines for the establishment and operationalization of the '
            'Local Youth Development Office (LYDO) in cities and municipalities. '
            'Defines the LYDO mandate, staffing, and coordination with SK and NYC.'
        ),
        'external_url': 'https://www.dilg.gov.ph/PDF_File/issuances/mc/DILG_NYC-JMC-2016-01.pdf',
    },
    {
        'title': 'Grassroots Participatory Budgeting Process — Youth Participation',
        'law_number': 'DBM-DILG-NAPC JMC 2012-01',
        'year_enacted': 2012,
        'category': 'governance',
        'resource_type': 'link',
        'tags': 'participatory budgeting,Bottom-Up Budgeting,youth participation,barangay',
        'is_featured': False,
        'description': (
            'Guidelines on the Grassroots Participatory Budgeting Process (formerly '
            'Bottom-Up Budgeting) that includes youth representatives in local '
            'budget planning. Outlines how SK and youth organizations can engage '
            'in barangay development planning and budget formulation.'
        ),
        'external_url': 'https://www.dbm.gov.ph/',
    },

    # â”€â”€ Sports & Arts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    {
        'title': 'National Sports Development Act',
        'law_number': 'RA 10699',
        'year_enacted': 2015,
        'category': 'legal',
        'resource_type': 'link',
        'tags': 'sports,PSC,PhilSports,athletics,youth sports,development',
        'is_featured': False,
        'description': (
            'Strengthened the Philippine Sports Commission (PSC) mandate and '
            'institutionalized sports programs for youth development. Provides '
            'for grassroots sports development programs, sports scholarships, '
            'and the Palarong Pambansa which showcases youth athletic talent.'
        ),
        'external_url': 'https://www.officialgazette.gov.ph/2015/10/16/republic-act-no-10699/',
    },
]


class Command(BaseCommand):
    help = 'Seed the library with Philippine youth-related laws and government materials'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Delete all existing seeded resources before re-seeding',
        )

    def handle(self, *args, **options):
        if options['clear']:
            deleted, _ = Resource.objects.filter(uploaded_by__isnull=True).delete()
            self.stdout.write(self.style.WARNING(f'Cleared {deleted} existing seeded resources.'))

        created_count = 0
        skipped_count = 0

        for data in RESOURCES:
            title = data['title']
            if Resource.objects.filter(title=title).exists():
                skipped_count += 1
                continue

            Resource.objects.create(
                title=title,
                law_number=data.get('law_number', ''),
                year_enacted=data.get('year_enacted'),
                description=data.get('description', ''),
                category=data.get('category', 'legal'),
                resource_type=data.get('resource_type', 'link'),
                tags=data.get('tags', ''),
                external_url=data.get('external_url', ''),
                is_published=True,
                is_featured=data.get('is_featured', False),
                uploaded_by=None,
            )
            created_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f'[OK] Seeded {created_count} resources. '
                f'Skipped {skipped_count} already-existing entries.'
            )
        )

