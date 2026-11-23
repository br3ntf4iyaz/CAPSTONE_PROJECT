"""Verified content for the two SK courses.

Everything below is taken from the texts of Republic Act No. 10742 (SK Reform Act of 2015), Republic Act No. 11768
(which amended it in 2022) and DBM-DILG-NYC Joint Memorandum Circular No. 1, s. 2025. The older seed text for these courses
contained wrong figures (for example a "60/20/20" split of the SK fund and "10% of the IRA"), so these lessons replace it.

Lessons are marked replace=True: the seed command swaps them in only when no learner has answered that lesson yet.
"""
from .lms_content_extra import q

SOURCE = 'Source: RA 10742 as amended by RA 11768, and DBM-DILG-NYC JMC No. 1, s. 2025.'

FINANCIAL_LITERACY = {
    'title': 'Financial Literacy for SK',
    'modules': [
        {
            'title': 'Module 1: Fundamentals of Public Financial Management', 'order': 1,
            'lessons': [
                {
                    'order': 1, 'title': 'Introduction to Public Financial Management', 'duration': 20, 'replace': True,
                    'content': (
                        'Public financial management is how government money is planned, spent, recorded and reported. The SK fund is '
                        'public money, so the same basic rules apply to it.\n\n'
                        '**Two basic principles** of the Government Auditing Code (PD 1445), repeated in the 2025 joint circular:\n'
                        '- No money shall be paid out of any public treasury or depository except in pursuance of an appropriation law or '
                        'other specific statutory authority.\n'
                        '- Government funds or property shall be spent or used solely for public purposes.\n\n'
                        '**A budget** is a financial plan: the estimates of income and expenditures for one fiscal year. For the SK, the annual '
                        'budget is prepared according to the approved Annual Barangay Youth Investment Program (ABYIP).\n\n'
                        '**Audit:** all SK funds are subject to existing budgeting, accounting and auditing laws, rules and regulations.\n\n'
                        + SOURCE
                    ),
                    'questions': [
                        q('What does the Government Auditing Code say about government funds?', 'Government funds must be spent solely for public purposes.',
                          'They shall be spent or used solely for public purposes', 'They may be used for any purpose the official prefers',
                          'They belong to the official who holds them', 'They need no records'),
                        q('Money may be paid out of a public treasury only:', 'Payment must be in pursuance of an appropriation law or other specific statutory authority.',
                          'In pursuance of an appropriation law or other specific statutory authority', 'Whenever an official asks for it',
                          'After the end of the fiscal year without any basis', 'If the amount is small'),
                        q('What is a budget?', 'A budget is the financial plan with the estimates of income and expenditures for one fiscal year.',
                          'A financial plan of estimated income and expenditures for one fiscal year', 'A list of all SK members',
                          'A report of what was spent last year', 'A receipt for one purchase'),
                        q('The SK annual budget must be prepared in accordance with:', 'The annual budget follows the approved ABYIP.',
                          'The approved Annual Barangay Youth Investment Program (ABYIP)', 'Any list of activities the chairperson likes',
                          'Last year\'s receipts only', 'The barangay captain\'s personal plan'),
                    ],
                },
                {
                    'order': 2, 'title': 'Understanding SK Financial Responsibilities', 'duration': 20, 'replace': True,
                    'content': (
                        '**The SK fund:** ten percent (10%) of the general fund of the barangay is set aside for the SK (Section 20 of RA 10742, '
                        'as amended). The Sangguniang Barangay appropriates it in lump sum, and it is disbursed solely for youth development and '
                        'empowerment purposes.\n\n'
                        '**Financial independence:** the SK has financial independence in its operations, disbursements and encashment of its '
                        'funds. Its funds are kept in a current account in the name of the SK in a government-owned bank, with the SK chairperson and '
                        'the SK treasurer as the official signatories.\n\n'
                        '**Release:** the SK funds are released automatically by the barangay and are not subject to any lien or holdback. They are '
                        'deposited in the SK current account not later than five (5) working days after the barangay\'s monthly National Tax Allotment '
                        'share is credited.\n\n'
                        '**Bonded officials:** the SK chairperson and the SK treasurer must be properly bonded (fidelity bond). The fee is chargeable '
                        'against the SK funds.\n\n'
                        '**The treasurer** takes custody of SK funds and property and keeps the financial records.\n\n'
                        + SOURCE
                    ),
                    'questions': [
                        q('How much of the general fund of the barangay is set aside for the SK?', 'Ten percent (10%) of the general fund of the barangay is set aside for the SK.',
                          '10% of the general fund', '5% of the general fund', '25% of the general fund', '50% of the general fund'),
                        q('Who are the official signatories of the SK current account?', 'The SK chairperson and the SK treasurer are the official signatories.',
                          'The SK chairperson and the SK treasurer', 'The punong barangay and the barangay treasurer',
                          'The SK secretary alone', 'Any SK kagawad'),
                        q('May the barangay hold back SK funds for its own purposes?', 'SK funds are released automatically and are not subject to any lien or holdback.',
                          'No. SK funds are released automatically with no lien or holdback', 'Yes, whenever the barangay needs money',
                          'Yes, until the SK reports', 'Yes, but only half'),
                        q('The SK fund is disbursed solely for:', 'It is disbursed solely for youth development and empowerment purposes.',
                          'Youth development and empowerment purposes', 'Personal needs of SK officials', 'Barangay hall repairs', 'Any purpose approved by one official'),
                    ],
                },
                {
                    'order': 3, 'title': 'Principles of Financial Accountability', 'duration': 20, 'replace': True,
                    'content': (
                        'Accountability means being answerable for how public money is used.\n\n'
                        '**Who is responsible:** the responsibility and accountability in the use and disbursement of SK funds rest on the SK '
                        'officials concerned. They must make sure the funds are used strictly in accordance with the applicable budgeting, accounting '
                        'and auditing rules and the procurement law.\n\n'
                        '**Rules to remember:**\n'
                        '- All payments out of the SK fund must be in pursuance of the annual or supplemental budget authorized by SK resolution, and '
                        'for public purposes only.\n'
                        '- All claims against the SK funds must be supported with complete documentation.\n'
                        '- All payments are made through Disbursement Vouchers, as prescribed in the Handbook on the Financial Transactions of the '
                        'Sangguniang Kabataan (HFTSK).\n\n'
                        '**Sanction:** officials who do not comply may be held liable under Section 61 of RA 7160, RA 10742 as amended, and other '
                        'applicable laws.\n\n'
                        + SOURCE
                    ),
                    'questions': [
                        q('On whom does the responsibility for the use of SK funds rest?', 'It rests on the SK officials concerned.',
                          'On the SK officials concerned', 'Only on the barangay captain', 'On the Commission on Elections', 'On nobody in particular'),
                        q('All payments out of the SK fund must be made:', 'Payments are made in pursuance of the budget authorized by SK resolution.',
                          'In pursuance of the annual or supplemental budget authorized by SK resolution', 'Without a budget if the amount is small',
                          'Only in cash without records', 'Whenever the chairperson decides'),
                        q('How are payments out of the SK fund made, according to the circular?', 'Payments are made through Disbursement Vouchers as prescribed in the HFTSK.',
                          'Through Disbursement Vouchers', 'By verbal instruction', 'Through text messages', 'By personal loan'),
                        q('Claims against the SK funds must be:', 'All claims must be supported with complete documentation.',
                          'Supported with complete documentation', 'Paid first and documented much later', 'Approved by anyone', 'Kept secret from the KK'),
                    ],
                },
            ],
        },
        {
            'title': 'Module 2: Budget Planning', 'order': 2,
            'lessons': [
                {
                    'order': 1, 'title': 'SK Budget Preparation', 'duration': 25, 'replace': True,
                    'content': (
                        'The SK budget follows a fixed cycle that matches the barangay\'s budget cycle.\n\n'
                        '**1. Estimate the fund:** the barangay treasurer informs the SK chairperson and the SK treasurer in writing, on or before '
                        '**September 15**, of the estimated 10% of the barangay general fund for the next fiscal year, with a certification of income.\n\n'
                        '**2. Approve the ABYIP:** the SK approves the ABYIP by resolution before it starts preparing the annual budget.\n\n'
                        '**3. Prepare the budget:** the SK chairperson, with the help of the SK treasurer, prepares the annual budget: estimates of '
                        'income and the expenditure program.\n\n'
                        '**4. Submit to the SK members:** the proposed annual budget goes to the SK members not later than **October 16** for '
                        'authorization by SK resolution.\n\n'
                        '**5. Approve:** the resolution is signed by the chairperson after approval by the majority of all the elected and '
                        'qualified members.\n\n'
                        'The budget documents are SKBP Form No. 1 (Budget of Expenditures and Sources of Financing), Form No. 2 (Program '
                        'Appropriation by PPA) and Form No. 3 (Plantilla of SK Officials).\n\n'
                        + SOURCE
                    ),
                    'questions': [
                        q('By what date does the barangay treasurer give the SK the estimate of its 10% fund?', 'The notice is due on or before September 15.',
                          'On or before September 15', 'On or before January 1', 'On or before March 31', 'On or before December 31 of the same year'),
                        q('What must the SK approve before it prepares the annual budget?', 'The ABYIP is approved by resolution before the budget is prepared.',
                          'The Annual Barangay Youth Investment Program (ABYIP)', 'The list of volunteers', 'The barangay captain\'s schedule', 'The quarterly report'),
                        q('Who prepares the SK annual budget?', 'The SK chairperson prepares it with the assistance of the SK treasurer.',
                          'The SK chairperson, with the assistance of the SK treasurer', 'The punong barangay alone', 'The COA auditor', 'Any volunteer'),
                        q('How is the SK annual budget authorized?', 'By SK resolution approved by the majority of all its elected and qualified members.',
                          'By SK resolution approved by the majority of all members', 'By the chairperson\'s verbal order', 'By the barangay captain only', 'It needs no approval'),
                    ],
                },
                {
                    'order': 2, 'title': 'Budget Allocation', 'duration': 25, 'replace': True,
                    'content': (
                        'Once the SK knows how much money it has, the law sets limits and priorities.\n\n'
                        '**Limits on the SK fund:**\n'
                        '- Not more than **25%** may be used for personal services (honorarium of SK members, including the treasurer and secretary).\n'
                        '- The total set aside for mandatory and continuing training must not be more than **15%** of the SK fund.\n\n'
                        '**Honorarium:** SK members, including the treasurer and secretary, receive a monthly honorarium chargeable to the SK '
                        'funds. It may not exceed the monthly compensation of the SK chairperson.\n\n'
                        '**PPAs must come from the ABYIP:** programs, projects and activities (PPAs) must be based on the approved ABYIP. Priority '
                        'PPAs under RA 11768 come first.\n\n'
                        '**Supplemental budget:** if funds allow, changes can be made through a supplemental budget, for example when funds are '
                        'actually available or new revenue comes in.\n\n'
                        '**Unspent money:** unexpended balances revert to the general fund of the SK at the end of the fiscal year (capital outlay '
                        'balances continue until fully spent, reverted or the project is completed).\n\n'
                        + SOURCE
                    ),
                    'questions': [
                        q('What is the most the SK fund may be used for personal services?', 'Not more than 25% of the SK fund may be allocated for personal services.',
                          'Not more than 25%', 'Not more than 5%', 'At least 75%', 'There is no limit'),
                        q('What is the limit for the mandatory and continuing training of SK officials?', 'The total appropriated for training must not be more than 15% of the SK fund.',
                          'Not more than 15% of the SK fund', 'Not more than 1%', 'At least 50%', 'No amount may be set aside'),
                        q('PPAs in the SK budget must be based on:', 'PPAs must be based on the approved ABYIP.',
                          'The approved ABYIP', 'Whatever is popular this week', 'The previous chairperson\'s notes', 'Verbal suggestions only'),
                        q('What happens to unexpended balances at the end of the fiscal year?', 'They revert to the general fund of the SK, except capital outlay balances.',
                          'They revert to the general fund of the SK', 'They go to the barangay captain', 'They are shared among SK officials', 'They disappear'),
                    ],
                },
                {
                    'order': 3, 'title': 'Financial Planning', 'duration': 20, 'replace': True,
                    'content': (
                        'Good budgets come from good plans.\n\n'
                        '**The CBYDP:** within three (3) months from assuming office, the SK, in consultation with and with the concurrence of the '
                        'majority of the Katipunan ng Kabataan (KK) assembled with a quorum, formulates a **3-year rolling plan** called the '
                        'Comprehensive Barangay Youth Development Plan (CBYDP).\n\n'
                        '**The ABYIP:** the CBYDP is the basis of the Annual Barangay Youth Investment Program, which lists the specific PPAs with '
                        'their costs and the timing of fund releases, and shows the total resource requirement for the budget year.\n\n'
                        '**Priorities:** both plans give priority to PPAs that promote the thrusts of the Philippine Youth Development Plan: health, '
                        'education, environment, global mobility, active citizenship, governance, social equity and inclusion, peace-building and '
                        'security, human rights, gender equality and economic empowerment.\n\n'
                        '**Examples named in the law:** student stipends and other educational assistance; sports and wellness projects; skills '
                        'training, summer employment, on-the-job training and livelihood assistance; climate action and calamity preparedness; and '
                        'capacity-building for grassroots youth organizations and leadership.\n\n'
                        + SOURCE
                    ),
                    'questions': [
                        q('What is the CBYDP?', 'The CBYDP is the 3-year rolling plan of the SK.',
                          'A 3-year rolling plan of the SK', 'A yearly list of receipts', 'A barangay election schedule', 'A report to COA'),
                        q('Within how long after assuming office must the SK formulate the CBYDP?', 'Within three (3) months from assumption to office.',
                          'Within three months', 'Within three years', 'Within one week', 'Before the election'),
                        q('With whom does the SK consult in formulating the CBYDP?', 'The SK consults with and secures the concurrence of the Katipunan ng Kabataan.',
                          'The Katipunan ng Kabataan', 'Only private companies', 'Nobody', 'Only the SK secretary'),
                        q('Which of these is named among the priority PPAs?', 'Educational assistance such as student stipends is a named priority.',
                          'Student stipends and other educational assistance', 'Parties for officials', 'Personal travel', 'Purchase of private vehicles'),
                    ],
                },
            ],
        },
        {
            'title': 'Module 3: Financial Documentation and Accountability', 'order': 3,
            'lessons': [
                {
                    'order': 1, 'title': 'Financial Records and Documentation', 'duration': 20, 'replace': True,
                    'content': (
                        'If it is not documented, it cannot be proven.\n\n'
                        '**Records:** all SK funds, from any source, are stated in the financial records kept by the SK treasurer. A copy goes '
                        'to the Sangguniang Barangay. The records are kept in the simplified manner prescribed by the Commission on Audit (COA).\n\n'
                        '**Disbursement Vouchers:** every payment out of the SK fund goes through a Disbursement Voucher, as prescribed in the Handbook '
                        'on the Financial Transactions of the Sangguniang Kabataan (HFTSK). The joint circular states that COA Circular No. 2020-003 '
                        '(January 28, 2020) prescribes the HFTSK.\n\n'
                        '**Complete documentation:** every claim against the SK funds needs complete supporting documents.\n\n'
                        '**Turnover:** before the end of their term, outgoing officials take an inventory of SK properties, financial records, '
                        'documents and money accountabilities and turn them over to the incoming officials.\n\n'
                        + SOURCE
                    ),
                    'questions': [
                        q('Who keeps the financial records of the SK?', 'The SK treasurer keeps the financial records.',
                          'The SK treasurer', 'The punong barangay', 'The SK kagawad on duty', 'The Commission on Elections'),
                        q('What document is used for payments out of the SK fund?', 'Payments are made through Disbursement Vouchers.',
                          'A Disbursement Voucher', 'A text message', 'An invitation letter', 'A membership form'),
                        q('To whom is a copy of the SK financial records furnished?', 'A copy is furnished to the Sangguniang Barangay.',
                          'The Sangguniang Barangay', 'No one', 'Only the supplier', 'Only the SK secretary'),
                        q('What do outgoing SK officials do before the end of their term?', 'They take an inventory of properties, records and money accountabilities and turn them over.',
                          'Take an inventory and turn over properties, records and money accountabilities', 'Destroy old records', 'Keep the SK property', 'Close the bank account'),
                    ],
                },
                {
                    'order': 2, 'title': 'Financial Reporting', 'duration': 20, 'replace': True,
                    'content': (
                        'Reporting shows the community where the money went.\n\n'
                        '**Quarterly statements:** at the end of every quarter, the SK treasurer submits to the SK and to the Sangguniang Barangay '
                        'certified and detailed statements of actual income and expenditures. In the circular, the SK chairperson, with the '
                        'assistance of the SK treasurer and secretary, prepares the budget accountability reports.\n\n'
                        '**Posting:** these statements are posted on the SK Full Public Disclosure Policy Board and in at least three conspicuous '
                        'places in the barangay, and if possible through traditional and non-traditional media.\n\n'
                        '**To the Katipunan ng Kabataan:** the treasurer reports on the financial status of the SK during the regular KK assembly. '
                        'The written financial report of all SK funds and property is made available to KK members.\n\n'
                        '**Annual and end-of-term reports:** the SK submits its annual and end-of-term program accomplishments and financial reports '
                        'to the Sangguniang Barangay and presents them at the KK assembly.\n\n'
                        + SOURCE
                    ),
                    'questions': [
                        q('How often are the statements of actual income and expenditures prepared?', 'They are prepared at the end of every quarter.',
                          'At the end of every quarter', 'Only once in three years', 'Only when asked', 'Never'),
                        q('Where must the quarterly statements be posted?', 'They are posted on the SK Full Public Disclosure Policy Board and in at least three conspicuous places.',
                          'On the SK Full Public Disclosure Policy Board and in at least three conspicuous places', 'Only in the SK treasurer\'s bag',
                          'Nowhere', 'Only in the mayor\'s office'),
                        q('To whom does the SK treasurer report on the SK\'s financial status during the regular assembly?', 'The treasurer reports to the Katipunan ng Kabataan.',
                          'The Katipunan ng Kabataan', 'Only the punong barangay', 'Only COA', 'No one'),
                        q('To whom are the annual and end-of-term financial reports submitted?', 'They are submitted to the Sangguniang Barangay and presented at the KK assembly.',
                          'The Sangguniang Barangay, and presented at the KK assembly', 'Only to the SK secretary', 'To a private company', 'To nobody'),
                    ],
                },
                {
                    'order': 3, 'title': 'Transparency and Accountability', 'duration': 25, 'replace': True,
                    'content': (
                        'Transparency means the community can see the plans, the budget and the results.\n\n'
                        '**What is posted:** the SK secretary posts the approved CBYDP, the ABYIP and the SK resolutions approving them on the SK Full '
                        'Public Disclosure Policy Board and in at least three conspicuous places in the barangay. The resolution approving the SK '
                        'annual or supplemental budget is posted not later than five (5) days after its approval.\n\n'
                        '**Review of the budget:** the SK secretary submits the budget and supporting documents to the sangguniang panlungsod or '
                        'sangguniang bayan, through the city or municipal budget officer, within ten (10) days from approval. The sanggunian reviews '
                        'it within sixty (60) days. If it does not finish in time, the budget is deemed approved. Items that are contrary to the '
                        'limits (such as 25% personal services and 15% training) or have no legal basis can be declared inoperative.\n\n'
                        '**Sanctions:** officials who do not comply may be held liable under the law.\n\n'
                        + SOURCE
                    ),
                    'questions': [
                        q('Who causes the posting of the approved CBYDP and ABYIP?', 'The SK secretary causes the posting.',
                          'The SK secretary', 'The SK treasurer only', 'The barangay driver', 'The COA'),
                        q('Within how many days is the SK budget submitted to the sangguniang panlungsod or bayan?', 'It is submitted within ten (10) days from approval.',
                          'Within ten (10) days of its approval', 'After one year', 'Within one hour', 'Only if asked'),
                        q('How long does the sanggunian have to review the SK budget?', 'It reviews it within sixty (60) days.',
                          'Sixty (60) days', 'Seven days', 'Two years', 'There is no deadline'),
                        q('What happens if the sanggunian does not finish its review on time?', 'The budget is deemed approved.',
                          'The budget is deemed approved', 'The SK fund is cancelled', 'The SK officials are removed', 'The budget is deemed rejected'),
                    ],
                },
            ],
        },
    ],
}

SK_GOVERNANCE = {
    'title': 'SK Governance Fundamentals',
    'modules': [
        {
            'title': 'Module 1: Introduction to SK Governance', 'order': 1,
            'lessons': [
                {
                    'order': 1, 'title': 'Overview of SK Governance', 'duration': 20, 'replace': True,
                    'content': (
                        '**The Katipunan ng Kabataan (KK):** in every barangay, the KK is made up of all citizens of the Philippines residing in the '
                        'barangay for at least six months who are 15 to 30 years old and registered. The KK elects the SK chairperson and members and '
                        'is the highest policy-making body on matters affecting the youth in the barangay. The SK consults the KK and secures its '
                        'concurrence in all its programs, plans and activities.\n\n'
                        '**The Sangguniang Kabataan (SK):** in every barangay there is an SK made up of a chairperson and seven (7) members elected '
                        'by the registered voters of the KK. The chairperson appoints, with the concurrence of the SK members, a secretary and a '
                        'treasurer from among the KK.\n\n'
                        '**Term:** the chairperson and members hold office for three (3) years.\n\n'
                        'Source: RA 10742 (Sections 4, 5, 7 and 11), as amended by RA 11768.'
                    ),
                    'questions': [
                        q('What ages does the Katipunan ng Kabataan cover?', 'The KK is made up of registered residents aged 15 to 30.',
                          '15 to 30 years old', '5 to 10 years old', '40 to 60 years old', 'Any age'),
                        q('Who elects the SK chairperson and members?', 'The KK elects them.',
                          'The registered voters of the Katipunan ng Kabataan', 'The barangay captain', 'The mayor', 'The SK secretary'),
                        q('How many elected members does the SK have, including the chairperson?', 'The SK is composed of a chairperson and seven members, eight in all.',
                          'A chairperson and seven members', 'A chairperson and two members', 'Twenty members', 'Only the chairperson'),
                        q('What is the term of office of the SK chairperson and members?', 'They hold office for a fixed term of three years.',
                          'Three (3) years', 'One month', 'Ten years', 'One week'),
                    ],
                },
                {
                    'order': 2, 'title': 'Roles and Responsibilities of SK Officials', 'duration': 25, 'replace': True,
                    'content': (
                        '**SK Chairperson:** calls and presides over the SK meetings and the KK assemblies, and votes in case of a tie; takes the lead in '
                        'the CBYDP and the ABYIP; ensures the programs in the ABYIP are implemented; signs the required documents and warrants for '
                        'expenditures. The chairperson is also an ex officio member of the Sangguniang Barangay and chairs its Committee on Youth '
                        'and Sports Development.\n\n'
                        '**SK Secretary:** keeps the records of the KK, prepares and keeps the minutes of the KK assemblies and SK meetings, and causes '
                        'the posting of resolutions, reports, the CBYDP and the ABYIP.\n\n'
                        '**SK Treasurer:** takes custody of SK property and funds, is a co-signatory in all withdrawals, certifies the availability of '
                        'funds, and submits quarterly statements of actual income and expenditures. The treasurer is a bonded officer.\n\n'
                        '**Qualifications:** elected officials are 18 to 24 years old on election day. The secretary and treasurer must be 18 to 30 '
                        'on the day of appointment, and the treasurer should have a business, accounting, finance, economics or bookkeeping '
                        'background.\n\n'
                        'Source: RA 10742 (Sections 10 to 15), as amended by RA 11768.'
                    ),
                    'questions': [
                        q('Which SK official is an ex officio member of the Sangguniang Barangay?', 'The SK chairperson is an ex officio member of the Sangguniang Barangay.',
                          'The SK chairperson', 'The SK secretary', 'The SK treasurer', 'Every SK kagawad'),
                        q('Who takes custody of SK property and funds?', 'The SK treasurer takes custody of SK property and funds.',
                          'The SK treasurer', 'The SK secretary', 'The punong barangay', 'The oldest kagawad'),
                        q('Who prepares and keeps the minutes of the SK meetings?', 'The SK secretary prepares and keeps the minutes.',
                          'The SK secretary', 'The SK treasurer', 'The mayor', 'The auditor'),
                        q('What is the age range of elected SK officials on election day?', 'They must be at least 18 but not more than 24 years old.',
                          '18 to 24 years old', '10 to 14 years old', '30 to 45 years old', 'There is no age limit'),
                    ],
                },
                {
                    'order': 3, 'title': 'Legal and Institutional Framework', 'duration': 20, 'replace': True,
                    'content': (
                        '**The laws:** the Sangguniang Kabataan Reform Act of 2015 (RA 10742) sets up the SK. It was amended in 2022 by RA 11768, which '
                        'provides, among other things, an honorarium and other benefits and privileges for SK officials.\n\n'
                        '**National Youth Commission (NYC):** created under RA 8044, the Youth in Nation-Building Act.\n\n'
                        '**Local bodies:** the Local Youth Development Council (LYDC) has representatives of youth and youth-serving organizations. '
                        'Every province, city and municipality has a Youth Development Office headed by a youth development officer. '
                        'The Pederasyon ng mga Sangguniang Kabataan brings SK chairpersons together at the municipal, city and provincial levels.\n\n'
                        '**Training:** SK officials must undergo the mandatory training programs before assuming office, and attend continuing '
                        'training during their term. The NYC and the DILG design these programs.\n\n'
                        'Source: RA 10742 and RA 11768.'
                    ),
                    'questions': [
                        q('Which law amended the SK Reform Act of 2015 in 2022?', 'RA 11768 amended RA 10742.',
                          'RA 11768', 'RA 7160', 'RA 8044', 'RA 9344'),
                        q('Under which law was the National Youth Commission created?', 'The NYC was created under RA 8044, the Youth in Nation-Building Act.',
                          'RA 8044', 'RA 11768', 'RA 10173', 'RA 7610'),
                        q('Who forms the Panlungsod na Pederasyon ng mga Sangguniang Kabataan in a city?', 'It is composed of the SK chairpersons of the barangays in the city.',
                          'The SK chairpersons of the barangays in the city', 'Only the mayors', 'Only the SK treasurers', 'The city\'s teachers'),
                        q('When must SK officials undergo the mandatory training programs?', 'They must undergo the mandatory training before assuming office.',
                          'Before assuming office', 'Only after their term', 'Never', 'Only when they wish'),
                    ],
                },
            ],
        },
        {
            'title': 'Module 2: Youth Development Planning', 'order': 2,
            'lessons': [
                {
                    'order': 1, 'title': 'Youth Development Priorities', 'duration': 20, 'replace': True,
                    'content': (
                        'The law names the thrusts the SK must prioritize. The CBYDP and the ABYIP give priority to programs, projects and activities '
                        'that promote the thrusts of the **Philippine Youth Development Plan (PYDP)**: health, education, environment, global mobility, '
                        'active citizenship, governance, social equity and inclusion, peace-building and security, human rights, gender equality and '
                        'economic empowerment.\n\n'
                        '**Examples of priority PPAs in RA 11768:**\n'
                        '- Student stipends and other educational assistance that reduce out-of-school youth and drop-outs\n'
                        '- Sports and wellness projects for physical and mental health, teenage pregnancy, substance abuse and other health issues\n'
                        '- Skills training, summer employment, on-the-job training and livelihood assistance\n'
                        '- Climate action, environmental protection and calamity preparedness\n'
                        '- Capacity-building for grassroots youth organizations and leadership, and values education\n\n'
                        'Source: RA 10742 as amended by RA 11768 (Section 20).'
                    ),
                    'questions': [
                        q('Which plan\'s thrusts do the CBYDP and ABYIP prioritize?', 'They prioritize the thrusts of the Philippine Youth Development Plan.',
                          'The Philippine Youth Development Plan (PYDP)', 'The barangay hall renovation plan', 'A private company\'s plan', 'A school timetable'),
                        q('Which is named as a priority program?', 'Skills training, summer employment, on-the-job training and livelihood assistance are named priorities.',
                          'Skills training and livelihood assistance', 'Luxury trips for officials', 'Private gifts', 'Decorations for personal use'),
                        q('Which kind of assistance is meant to reduce out-of-school youth?', 'Student stipends and other educational assistance.',
                          'Student stipends and other educational assistance', 'Parties', 'Trophies for officials', 'Printing of campaign posters'),
                        q('Which topic is among the PYDP thrusts?', 'Health is one of the thrusts.',
                          'Health', 'Casino gaming', 'Luxury shopping', 'Private business profits'),
                    ],
                },
                {
                    'order': 2, 'title': 'Planning and Program Development', 'duration': 25, 'replace': True,
                    'content': (
                        '**Step 1, consult the youth:** within three (3) months from assuming office, the SK, in consultation with and with the '
                        'concurrence of the Katipunan ng Kabataan, formulates a three-year rolling plan: the **Comprehensive Barangay Youth '
                        'Development Plan (CBYDP)**. It is aligned with the PYDP and with the local youth development plans.\n\n'
                        '**Step 2, the annual program:** the CBYDP is the basis of the **Annual Barangay Youth Investment Program (ABYIP)**. The ABYIP '
                        'contains the specific programs, projects and activities (PPAs) with their project costs and the timing of fund releases.\n\n'
                        '**Step 3, approve:** the ABYIP is prepared and approved by the SK through a resolution before the annual budget is prepared.\n\n'
                        '**Step 4, share:** the SK secretary posts the approved CBYDP, ABYIP and resolutions on the SK Full Public Disclosure Policy '
                        'Board and in at least three conspicuous places in the barangay.\n\n'
                        'Source: RA 10742 as amended by RA 11768, and DBM-DILG-NYC JMC No. 1, s. 2025.'
                    ),
                    'questions': [
                        q('How long is the CBYDP?', 'It is a three-year rolling plan.',
                          'A three-year rolling plan', 'A one-day plan', 'A ten-year plan', 'A plan with no period'),
                        q('What is the ABYIP?', 'The ABYIP lists the specific PPAs with costs for the year.',
                          'The annual program of PPAs with project costs', 'The list of SK members', 'The election schedule', 'A report to the mayor'),
                        q('What does the SK need from the KK when it formulates the CBYDP?', 'The SK consults the KK and needs the concurrence of the majority of the KK assembled with a quorum.',
                          'Consultation and concurrence', 'Nothing', 'Only a signature of the treasurer', 'Only gifts'),
                        q('Which document is the basis for preparing the ABYIP?', 'The CBYDP is the basis of the ABYIP.',
                          'The CBYDP', 'Last year\'s receipts', 'A random list', 'A newspaper article'),
                    ],
                },
                {
                    'order': 3, 'title': 'Project Implementation', 'duration': 20, 'replace': True,
                    'content': (
                        '**Implementing the plan:** the SK chairperson ensures that the programs, projects and activities in the ABYIP are '
                        'implemented, in coordination with the Sangguniang Barangay and the City or Municipal Youth Development Council.\n\n'
                        '**Working with others:** the SK can initiate and implement programs with national government agencies and with private or '
                        'non-government institutions. It also partners with the LYDC on advocacies such as good governance, climate change '
                        'adaptation, disaster risk reduction, youth employment and livelihood, health and anti-drug abuse, gender sensitivity and '
                        'sports development.\n\n'
                        '**Fund-raising:** the SK may hold fund-raising activities in line with the CBYDP. The proceeds are tax-exempt and go to the '
                        'general fund of the SK, and the specific purpose of the activity is satisfied first.\n\n'
                        '**Linggo ng Kabataan:** every barangay holds an annual Linggo ng Kabataan during the week where August 12 falls.\n\n'
                        '**Why it matters:** failing to implement the ABYIP programs without a justifiable reason is a ground for suspension or removal.\n\n'
                        'Source: RA 10742 (Sections 8, 13, 18 and 30), as amended by RA 11768.'
                    ),
                    'questions': [
                        q('Who ensures that the PPAs in the ABYIP are implemented?', 'The SK chairperson ensures implementation, in coordination with the Sangguniang Barangay and the youth development council.',
                          'The SK chairperson', 'The COA auditor', 'The barangay driver', 'No one'),
                        q('Where do the proceeds of an SK fund-raising activity go?', 'They accrue to the general fund of the SK, after the purpose of the activity is satisfied.',
                          'To the general fund of the SK', 'To the personal accounts of officials', 'To the barangay captain', 'They are destroyed'),
                        q('When is the Linggo ng Kabataan held?', 'It is held on the week where August 12 falls.',
                          'On the week where August 12 falls', 'On the week of Christmas', 'On the first week of March', 'It has no fixed week'),
                        q('Failing to implement the ABYIP programs without a justifiable reason can lead to:', 'It is a ground for suspension or removal after due process.',
                          'Suspension or removal after due process', 'A bonus', 'Nothing at all', 'A promotion'),
                    ],
                },
            ],
        },
        {
            'title': 'Module 3: Accountability and Transparency', 'order': 3,
            'lessons': [
                {
                    'order': 1, 'title': 'Public Accountability', 'duration': 20, 'replace': True,
                    'content': (
                        'SK officials are public officers who answer to the KK and to the law.\n\n'
                        '**Reports:** the SK submits its annual and end-of-term program accomplishments and financial reports to the Sangguniang '
                        'Barangay and presents them at the Katipunan ng Kabataan assembly.\n\n'
                        '**Persons in authority:** the SK chairperson and members are deemed persons in authority in their jurisdictions.\n\n'
                        '**Suspension and removal:** an elected SK official may, after due process, be suspended for not more than six (6) months or '
                        'removed by majority vote of all members of the Sangguniang Bayan or Panlungsod for grounds such as: absence from regular SK '
                        'meetings without valid cause two consecutive times or four times in twelve months; failure to convene the KK assembly '
                        'two consecutive times; failure to formulate the CBYDP and ABYIP or approve the annual budget on time without justifiable '
                        'reason; and failure to implement the ABYIP programs without justifiable reason.\n\n'
                        'Source: RA 10742 (Sections 8, 17 and 18).'
                    ),
                    'questions': [
                        q('To whom does the SK submit its annual and end-of-term reports?', 'To the Sangguniang Barangay, and the reports are presented at the KK assembly.',
                          'The Sangguniang Barangay, and presents them at the KK assembly', 'Nobody', 'A private company', 'The SK treasurer\'s family'),
                        q('For how long can an elected SK official be suspended at most, after due process?', 'Suspension is for not more than six months.',
                          'Not more than six (6) months', 'Ten years', 'One day only', 'There is no suspension'),
                        q('Which is a ground for suspension or removal?', 'Failing to convene the regular KK assembly two consecutive times is a ground.',
                          'Failing to convene the KK assembly two consecutive times', 'Attending all meetings', 'Posting reports on time', 'Passing the training'),
                        q('Who decides on removal of an elected SK official?', 'The majority vote of all members of the Sangguniang Bayan or Panlungsod.',
                          'The majority of all members of the Sangguniang Bayan or Panlungsod', 'A classmate', 'The SK secretary alone', 'A private vote of friends'),
                    ],
                },
                {
                    'order': 2, 'title': 'Community Participation', 'duration': 20, 'replace': True,
                    'content': (
                        '**KK assembly:** the Katipunan ng Kabataan meets at least once every six (6) months, or at the call of the SK chairperson, or '
                        'upon the written petition of at least one-twentieth (1/20) of its members, to decide on important issues affecting the youth.\n\n'
                        '**SK meetings:** the SK meets regularly once a month. Special meetings may be called by the chairperson or any four (4) members '
                        'with a written notice of the date, time, place and agenda received at least one day in advance. A majority of the members, '
                        'including the chairperson, is a quorum.\n\n'
                        '**Full public disclosure:** the SK adopts and implements a policy of full public disclosure of all its transactions and '
                        'documents involving public interest.\n\n'
                        '**Participation:** the SK consults the KK and needs its concurrence in all its programs, plans and activities.\n\n'
                        'Source: RA 10742 (Sections 5, 6, 8 and 9).'
                    ),
                    'questions': [
                        q('How often must the Katipunan ng Kabataan meet at the least?', 'At least once every six months.',
                          'At least once every six months', 'Once every ten years', 'Only during elections', 'Never'),
                        q('How often does the SK meet regularly?', 'The SK meets regularly once a month.',
                          'Once a month', 'Once in three years', 'Only when there is food', 'Daily'),
                        q('How many SK members can call a special meeting, apart from the chairperson?', 'Any four (4) members may call a special meeting.',
                          'Any four members', 'Only the treasurer', 'Only one member', 'No one'),
                        q('What does a policy of full public disclosure mean for the SK?', 'The SK discloses its transactions and documents involving public interest.',
                          'The SK makes its transactions and public-interest documents open', 'The SK keeps everything secret', 'The SK hides its budget', 'The SK only informs friends'),
                    ],
                },
                {
                    'order': 3, 'title': 'Governance Evaluation', 'duration': 20, 'replace': True,
                    'content': (
                        'Evaluating governance means checking whether the SK did what it planned and whether the rules were followed.\n\n'
                        '**External review:** the Sangguniang Bayan or Panlungsod reviews the SK annual and supplemental budget within sixty (60) days. '
                        'Non-compliance makes the budget inoperative in whole or in part. If the sanggunian does not finish on time, the budget is '
                        'deemed approved.\n\n'
                        '**Audit:** all SK funds are subject to the existing accounting and auditing laws, rules and regulations.\n\n'
                        '**Self-check questions:** Did we carry out the programs in the ABYIP? Did we stay within the limits of the SK fund? Did we '
                        'post our plans, budget and reports? Did we report to the Katipunan ng Kabataan?\n\n'
                        '**Turnover:** before the end of the term, outgoing officials take an inventory of SK properties, financial records and money '
                        'accountabilities and turn them over to the new officials.\n\n'
                        'Source: RA 10742 (Section 20) and DBM-DILG-NYC JMC No. 1, s. 2025.'
                    ),
                    'questions': [
                        q('Who reviews the SK annual budget?', 'The Sangguniang Bayan or Panlungsod reviews it.',
                          'The Sangguniang Bayan or Sangguniang Panlungsod', 'A neighbor', 'The SK secretary alone', 'A random person'),
                        q('What can happen to an SK budget that does not comply with the law?', 'Non-compliance can make the budget inoperative in whole or in part.',
                          'It can be declared inoperative in whole or in part', 'It is approved faster', 'It is doubled', 'Nothing can happen'),
                        q('Which laws apply to all SK funds?', 'All SK funds are subject to existing accounting and auditing laws, rules and regulations.',
                          'Existing accounting and auditing laws, rules and regulations', 'No laws at all', 'Only the personal rules of officials', 'Only school rules'),
                        q('Which is a good evaluation question for an SK?', 'Checking whether the ABYIP programs were carried out is a good evaluation question.',
                          'Did we carry out the programs in the ABYIP?', 'Who can we blame?', 'How can we avoid reporting?', 'How can we keep records secret?'),
                    ],
                },
            ],
        },
    ],
}

COURSES = [FINANCIAL_LITERACY, SK_GOVERNANCE]
