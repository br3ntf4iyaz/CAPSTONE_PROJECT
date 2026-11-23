"""Videos and study materials for the seed lessons.

Every link below was opened and checked when it was added:
  * each YouTube video answered the YouTube oEmbed check (public, and allowed to be shown outside YouTube);
  * each reading link answered with a normal page.
The video's title and channel are written next to the link, so the learner and the administrator know exactly what it is.
Videos are only attached to lessons where a clearly on-topic video from a recognizable channel was found. The other lessons
get reading materials instead. An administrator can add, replace or remove any of this in the course builder.

The seed command never overwrites a video or a list of study materials that already exists on a lesson.
"""

YT = 'https://www.youtube.com/watch?v='


def video(vid, title, channel):
    return {'url': YT + vid, 'title': f'{title} ({channel})'}


def link(title, url, source=''):
    return {'title': title, 'url': url, 'source': source}


RA_10742 = link('Republic Act No. 10742: Sangguniang Kabataan Reform Act of 2015', 'https://lawphil.net/statutes/repacts/ra2016/ra_10742_2016.html', 'Lawphil Project')
RA_11768 = link('Republic Act No. 11768: Strengthening the Sangguniang Kabataan', 'https://lawphil.net/statutes/repacts/ra2022/ra_11768_2022.html', 'Lawphil Project')
RA_8044 = link('Republic Act No. 8044: Youth in Nation-Building Act', 'https://lawphil.net/statutes/repacts/ra1995/ra_8044_1995.html', 'Lawphil Project')
JMC_2025 = link(
    'DBM-DILG-NYC Joint Memorandum Circular No. 1, s. 2025 (PDF)',
    'https://www.dbm.gov.ph/wp-content/uploads/Issuances/2025/Joint-Memorandum-Circular/DBM-DILG-NYC-JOINT-MEMORANDUM-CIRCULAR-(JMC)-NO.-1-DATED-MAY-23,-2025.pdf',
    'DBM')
SK_MANUALS = link('SK Manual e-library: SK Operations Manual 2023 and the SK financial handbook', 'https://manila.ncr.dilg.gov.ph/e-library/sk-manual', 'DILG Manila Sub-LG Resource Center')
HFTSK = link('Handbook on the Financial Transaction of the Sangguniang Kabataan (PDF)', 'https://drive.google.com/file/d/1BT0DVSvXqBbM4I8WGvxe5zwxPqcMYxND/view', 'DILG Manila e-library copy')
SK_OPS = link('Sangguniang Kabataan Operations Manual 2023 (PDF)', 'https://drive.google.com/file/d/1YJds-dx5ysaFT4MibG7QZYfHHsnMcC8m/view', 'DILG Manila e-library copy')
PYDP = link('Philippine Youth Development Plan 2023-2028 (PDF)', 'https://drive.google.com/file/d/1dcIQfgzZWYWhL6usBFAF6Xo1xLEyuw7f/view', 'National Youth Commission')
NYC_DOWNLOADS = link('National Youth Commission: Downloadables (plans, YORP manuals, laws)', 'https://nyc.gov.ph/downloadables', 'National Youth Commission')
TESDA_SK = link(
    'TESDA Competency Standards: Bookkeeping for SK Financial Transactions, Level II (PDF)',
    'https://tesda.gov.ph/Downloadables/CS/CS%20-%20Bookkeeping%20for%20Sangguniang%20Kabataan%20(SK)%20Financial%20Transactions%20Level%20II%20v2.pdf',
    'TESDA')
NPC_DPA = link('Data Privacy Act (RA 10173) and youth privacy materials', 'https://privacy.gov.ph/data-privacy-act/', 'National Privacy Commission')


def wiki(title, page):
    return link(title, f'https://en.wikipedia.org/wiki/{page}', 'Wikipedia (general background)')


SINEK = video('qp0HIF3SfI4', 'How Great Leaders Inspire Action, Simon Sinek', 'TED')
TREASURE = video('eIho2S0ZahI', 'How to Speak So That People Want to Listen, Julian Treasure', 'TED')
LISTENING = video('rzsVh8YwZEQ', 'Active Listening', 'LearnFree')
AMA_CONFLICT = video('LR_DLCYqGnA', 'How to Manage Conflict in the Workplace', 'American Management Association')
SMART = video('1-SvuFIQjK8', 'SMART Goals - Quick Overview', 'DecisionSkills')
LIFECYCLE = video('p73dIKvtD4Q', 'Understanding the Project Management Lifecycle', 'Smartsheet')
PHASES = video('BIgbwM2ieU8', 'The Project Life Cycle and its Five Main Phases Explained', 'The Digital Project Manager')
VOLUNTEERS = video('p59tzrmCgac', 'Managing volunteers: Tips for success', 'Habitat for Humanity')
CITIZENS = video('-N7lRYMmbXU', 'We the Digital Citizens', 'Common Sense Education')
SAFETY = video('kUyQI0USNSY', 'A Common Sense Approach to Internet Safety', 'Google')
FOOTPRINT = video('ottnH427Fr8', 'Teen Voices: Oversharing and Your Digital Footprint', 'Common Sense Education')
SK_BUDGET = video(
    'mDJUaE-9VDY', '2026 SK Budget Preparation aligned with JMC No. 1 s. 2025 (third-party tutorial)', 'Panelo Accounting Firm Channel')

# (course title, lesson title) -> {'video': {...} or None, 'resources': [...]}
MEDIA = {
    # ── Leadership Fundamentals
    ('Leadership Fundamentals', 'What Is Leadership?'): {'resources': [wiki('Leadership', 'Leadership')]},
    ('Leadership Fundamentals', 'Types of Leadership Styles'): {'resources': [wiki('Leadership style', 'Leadership_style')]},
    ('Leadership Fundamentals', 'Building a Vision'): {'resources': [wiki('Vision statement', 'Vision_statement')]},
    ('Leadership Fundamentals', 'Decision-Making Under Pressure'): {'resources': [wiki('Decision-making', 'Decision-making')]},
    ('Leadership Fundamentals', 'Inspiring and Motivating Others'): {'video': SINEK, 'resources': [wiki('Leadership', 'Leadership')]},

    # ── Youth Governance 101
    ('Youth Governance 101', 'What Is Youth Governance?'): {'resources': [RA_8044, NYC_DOWNLOADS]},
    ('Youth Governance 101', 'Philippine Youth Laws and Policies'): {'resources': [RA_8044, RA_10742, RA_11768]},
    ('Youth Governance 101', 'The Role of Youth in Local Government'): {'resources': [RA_10742]},
    ('Youth Governance 101', 'Participating in Barangay Governance'): {'resources': [RA_10742]},
    ('Youth Governance 101', 'Accountability and Transparency in Governance'): {'resources': [JMC_2025]},

    # ── Communication Skills for Leaders
    ('Communication Skills for Leaders', 'The Fundamentals of Effective Communication'): {'video': TREASURE},
    ('Communication Skills for Leaders', 'Active Listening'): {'video': LISTENING, 'resources': [wiki('Active listening', 'Active_listening')]},
    ('Communication Skills for Leaders', 'Public Speaking Basics'): {'resources': [wiki('Public speaking', 'Public_speaking')]},
    ('Communication Skills for Leaders', 'Non-Verbal Communication'): {'resources': [wiki('Nonverbal communication', 'Nonverbal_communication')]},
    ('Communication Skills for Leaders', 'Conflict Resolution Through Communication'): {
        'video': AMA_CONFLICT, 'resources': [wiki('Conflict resolution', 'Conflict_resolution')]},

    # ── Financial Literacy for SK (official documents; one third-party budget tutorial)
    ('Financial Literacy for SK', 'Introduction to Public Financial Management'): {'resources': [JMC_2025, RA_10742]},
    ('Financial Literacy for SK', 'Understanding SK Financial Responsibilities'): {'resources': [JMC_2025, RA_11768]},
    ('Financial Literacy for SK', 'Principles of Financial Accountability'): {'resources': [JMC_2025, HFTSK]},
    ('Financial Literacy for SK', 'SK Budget Preparation'): {'video': SK_BUDGET, 'resources': [JMC_2025]},
    ('Financial Literacy for SK', 'Budget Allocation'): {'resources': [JMC_2025, RA_11768]},
    ('Financial Literacy for SK', 'Financial Planning'): {'resources': [JMC_2025, PYDP]},
    ('Financial Literacy for SK', 'Financial Records and Documentation'): {'resources': [HFTSK, TESDA_SK, SK_MANUALS]},
    ('Financial Literacy for SK', 'Financial Reporting'): {'resources': [JMC_2025, HFTSK]},
    ('Financial Literacy for SK', 'Transparency and Accountability'): {'resources': [JMC_2025, RA_10742]},

    # ── Digital Skills for Youth Leaders
    ('Digital Skills for Youth Leaders', 'Digital Literacy Basics'): {'video': CITIZENS, 'resources': [wiki('Digital literacy', 'Digital_literacy')]},
    ('Digital Skills for Youth Leaders', 'Using Social Media for Advocacy'): {'resources': [wiki('Social media', 'Social_media')]},
    ('Digital Skills for Youth Leaders', 'Creating Effective Online Content'): {'resources': [wiki('Content creation', 'Content_creation')]},
    ('Digital Skills for Youth Leaders', 'Online Safety and Cybersecurity'): {'video': SAFETY, 'resources': [wiki('Computer security', 'Cybersecurity')]},
    ('Digital Skills for Youth Leaders', 'Google Tools for Youth Organizations'): {
        'resources': [link('Google Workspace Learning Center', 'https://support.google.com/a/users#topic=9797903', 'Google')]},
    ('Digital Skills for Youth Leaders', 'Data and Privacy Rights'): {'video': FOOTPRINT, 'resources': [NPC_DPA]},

    # ── SK Governance Fundamentals (official laws and circulars)
    ('SK Governance Fundamentals', 'Overview of SK Governance'): {'resources': [RA_10742, RA_11768]},
    ('SK Governance Fundamentals', 'Roles and Responsibilities of SK Officials'): {'resources': [RA_10742, SK_MANUALS]},
    ('SK Governance Fundamentals', 'Legal and Institutional Framework'): {'resources': [RA_10742, RA_11768, RA_8044]},
    ('SK Governance Fundamentals', 'Youth Development Priorities'): {'resources': [RA_11768, PYDP]},
    ('SK Governance Fundamentals', 'Planning and Program Development'): {'resources': [JMC_2025, PYDP]},
    ('SK Governance Fundamentals', 'Project Implementation'): {'resources': [RA_10742, SK_OPS]},
    ('SK Governance Fundamentals', 'Public Accountability'): {'resources': [RA_10742, JMC_2025]},
    ('SK Governance Fundamentals', 'Community Participation'): {'resources': [RA_10742]},
    ('SK Governance Fundamentals', 'Governance Evaluation'): {'resources': [JMC_2025]},

    # ── Youth Leadership and Communication
    ('Youth Leadership and Communication', 'What Makes a Great Youth Leader?'): {'video': SINEK},
    ('Youth Leadership and Communication', 'Effective Communication for Leaders'): {'video': TREASURE},
    ('Youth Leadership and Communication', 'Teamwork and Delegation'): {'resources': [wiki('Delegation', 'Delegation')]},
    ('Youth Leadership and Communication', 'Managing Conflict in a Team'): {'video': AMA_CONFLICT},
    ('Youth Leadership and Communication', 'Public Speaking for Youth Leaders'): {'resources': [wiki('Public speaking', 'Public_speaking')]},

    # ── Youth Organization Management
    ('Youth Organization Management', 'Roles and Responsibilities of Youth Leaders'): {'resources': [NYC_DOWNLOADS]},
    ('Youth Organization Management', 'Organizational Leadership Principles'): {'video': SINEK},
    ('Youth Organization Management', 'Effective Decision-Making'): {'resources': [wiki('Decision-making', 'Decision-making')]},
    ('Youth Organization Management', 'Goal Setting and Planning'): {'video': SMART},
    ('Youth Organization Management', 'Project Development'): {'video': LIFECYCLE, 'resources': [wiki('Project management', 'Project_management')]},
    ('Youth Organization Management', 'Resource Management'): {'resources': [wiki('Resource management', 'Resource_management')]},
    ('Youth Organization Management', 'Volunteer Coordination'): {'video': VOLUNTEERS, 'resources': [wiki('Volunteering', 'Volunteering')]},
    ('Youth Organization Management', 'Community Participation'): {'resources': [wiki('Community engagement', 'Community_engagement')]},
    ('Youth Organization Management', 'Project Evaluation'): {'video': PHASES, 'resources': [wiki('Program evaluation', 'Program_evaluation')]},
}
