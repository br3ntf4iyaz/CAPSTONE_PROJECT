"""Youth Organization Management: a course for officers, volunteers and leaders of youth organizations.

General management practice only. Notes and questions are written for the people who run a youth group
(officers, committee heads and volunteer coordinators). No video links are included.
"""
from .lms_content_extra import q

TITLE = 'Youth Organization Management'
DESCRIPTION = (
    'For officers, volunteers and leaders of youth organizations. Learn how to lead an organization, plan and run '
    'projects, work with volunteers, and involve the community.'
)
AUDIENCE = 'youth_org_leaders'
CATEGORY = 'leadership'

MODULES = [
    {
        'title': 'Module 1: Fundamentals of Youth Organization Leadership', 'order': 1,
        'lessons': [
            {
                'order': 1, 'title': 'Roles and Responsibilities of Youth Leaders', 'duration': 20,
                'content': (
                    'A youth organization works best when everyone knows their role.\n\n'
                    '**Common officer roles:** the **President** leads the organization and presides over meetings. The '
                    '**Secretary** keeps the minutes and records. The **Treasurer** keeps the money records and reports on '
                    'them. The **Auditor** checks that funds were used properly. A **PRO** shares news with members and the community.\n\n'
                    '**Committee heads** lead specific work, such as events, membership or fundraising.\n\n'
                    '**Shared responsibilities:** follow the constitution and by-laws, treat members fairly, and be honest with '
                    'the group\'s money and property.\n\n'
                    '**Tip:** write each role down with its tasks, so nothing is forgotten when officers change.'
                ),
                'questions': [
                    q('Who usually keeps the minutes of the meetings?', 'The Secretary keeps the minutes and the records of the organization.',
                      'The Secretary', 'The Treasurer', 'The Auditor', 'The newest member'),
                    q('Which officer is responsible for the money records and reporting on them?', 'The Treasurer keeps the financial records and reports on them.',
                      'The Treasurer', 'The Secretary', 'The PRO', 'The committee head for events'),
                    q('What does a PRO usually do?', 'A PRO shares information about the organization with members and the public.',
                      'Share news about the organization with members and the community', 'Keep the minutes', 'Audit the funds', 'Collect the dues only'),
                    q('Why should roles and tasks be written down?', 'Written roles avoid confusion and make it easy to pass duties to the next officers.',
                      'So duties are clear and easy to hand over when officers change', 'So only the president can read them',
                      'So members do not need to follow them', 'So the group never needs meetings'),
                ],
            },
            {
                'order': 2, 'title': 'Organizational Leadership Principles', 'duration': 20,
                'content': (
                    'Good leaders of youth organizations follow a few simple principles.\n\n'
                    '**Shared vision:** members work harder when they understand and agree on where the group is going.\n\n'
                    '**Integrity:** be honest and consistent, especially with funds and promises.\n\n'
                    '**Inclusion:** welcome members of different backgrounds and listen to quieter voices.\n\n'
                    '**Accountability:** report on what the group did and how resources were used.\n\n'
                    '**Developing others:** give members chances to lead small tasks so new leaders grow.\n\n'
                    '**Example:** a president who explains the budget openly earns the trust of members.'
                ),
                'questions': [
                    q('Why is a shared vision important in an organization?', 'Members work together better when they understand the goal.',
                      'Members understand and work toward the same goal', 'It removes the need for officers', 'It keeps decisions secret', 'It replaces the by-laws'),
                    q('Which action shows accountability?', 'Reporting openly on activities and how resources were used shows accountability.',
                      'Reporting how resources were used', 'Keeping the budget private', 'Changing the numbers when asked', 'Ignoring member questions'),
                    q('How do leaders develop new leaders?', 'Giving members small leadership tasks helps them grow.',
                      'Give members chances to lead small tasks', 'Do all the work themselves', 'Keep new members away from decisions', 'Avoid giving feedback'),
                    q('What does inclusion mean in a youth organization?', 'Inclusion means welcoming different members and hearing their views.',
                      'Welcoming different members and listening to their views', 'Only listening to the loudest members', 'Accepting only close friends', 'Holding meetings without notice'),
                ],
            },
            {
                'order': 3, 'title': 'Effective Decision-Making', 'duration': 20,
                'content': (
                    'Organizations make decisions all the time: what project to do, how to spend funds, who does what.\n\n'
                    '**A simple process:** 1) State the problem clearly. 2) Gather the facts. 3) List the options. 4) Compare the '
                    'options, including their costs and risks. 5) Decide, then write down the decision and who will act. '
                    '6) Check the results later.\n\n'
                    '**Involve the people affected:** decisions are easier to carry out when members helped make them.\n\n'
                    '**Tip:** when members disagree, go back to the shared goal and the facts, not to who speaks the loudest.'
                ),
                'questions': [
                    q('What is a good first step in making a decision?', 'A clear statement of the problem keeps the discussion focused.',
                      'State the problem clearly', 'Vote immediately', 'Ask the president to decide', 'Wait until the problem disappears'),
                    q('Why should the options be compared before deciding?', 'Comparing costs and risks leads to a better choice.',
                      'To see their costs and risks', 'To make the meeting longer', 'To avoid writing the decision', 'To exclude members'),
                    q('What should happen after the decision is made?', 'The decision and who will act should be written down, and results checked later.',
                      'Write it down, assign who will act and check the results later', 'Forget it until the next election', 'Keep it secret', 'Change it every day'),
                    q('When members disagree, the group should return to:', 'The shared goal and the facts keep the discussion fair.',
                      'The shared goal and the facts', 'Whoever speaks loudest', 'The oldest member\'s opinion only', 'A different topic'),
                ],
            },
        ],
    },
    {
        'title': 'Module 2: Organizational Planning', 'order': 2,
        'lessons': [
            {
                'order': 1, 'title': 'Goal Setting and Planning', 'duration': 20,
                'content': (
                    'A plan turns good intentions into action.\n\n'
                    '**SMART goals** are **S**pecific, **M**easurable, **A**chievable, **R**elevant and **T**ime-bound. '
                    'For example: "Recruit 20 new members by March" is clearer than "get more members".\n\n'
                    '**A basic plan answers:** What will we do? Who is responsible? When? With what resources? How will we know it worked?\n\n'
                    '**Tip:** start with the needs of your members and community, then choose goals that answer those needs.'
                ),
                'questions': [
                    q('What does the "M" in SMART goals stand for?', 'M means Measurable: you can tell whether the goal was reached.',
                      'Measurable', 'Mandatory', 'Minimal', 'Mysterious'),
                    q('Which is a SMART goal?', 'It is specific, measurable and has a deadline.',
                      'Recruit 20 new members by March', 'Get more members someday', 'Be popular', 'Do better'),
                    q('Which question belongs in a basic plan?', 'A plan states who is responsible for each task.',
                      'Who is responsible for each task?', 'Who can we blame?', 'How can we avoid reporting?', 'Which members can we ignore?'),
                    q('Where should goals start?', 'Goals that answer real needs get more support.',
                      'From the needs of members and the community', 'From what is easiest to copy', 'From the largest budget', 'From last year\'s photos'),
                ],
            },
            {
                'order': 2, 'title': 'Project Development', 'duration': 25,
                'content': (
                    'A project is a set of activities with a goal, a time frame and a budget.\n\n'
                    '**Project cycle:** identify the need, plan (objectives, activities, schedule, budget), implement, monitor, and '
                    'evaluate.\n\n'
                    '**A project proposal** usually includes the background, objectives, activities, schedule, budget, who is '
                    'responsible, and expected results.\n\n'
                    '**Risks:** think of what could go wrong (bad weather, low turnout, delays) and prepare a backup.\n\n'
                    '**Example:** a clean-up drive needs a date, a place, volunteers, equipment, permission from the barangay and a plan for the garbage.'
                ),
                'questions': [
                    q('What is a project?', 'A project is a set of activities with a goal, a time frame and a budget.',
                      'A set of activities with a goal, a time frame and a budget', 'A single meeting with no goal', 'A list of members', 'A permanent office'),
                    q('Which comes right after planning in the project cycle?', 'After planning comes implementation.',
                      'Implementation', 'Identifying the need', 'Evaluation', 'Closing the organization'),
                    q('Which belongs in a project proposal?', 'A proposal shows objectives, activities, schedule and budget.',
                      'Objectives, activities, schedule and budget', 'Only the names of friends', 'Only photos', 'Nothing in writing'),
                    q('Why list the possible risks of a project?', 'Preparing a backup reduces problems if something goes wrong.',
                      'To prepare a backup if something goes wrong', 'To cancel every project', 'To avoid asking for help', 'To hide the budget'),
                ],
            },
            {
                'order': 3, 'title': 'Resource Management', 'duration': 20,
                'content': (
                    'Resources are the people, money, materials and time the organization uses.\n\n'
                    '**Money:** make a budget before spending, record every income and expense, keep receipts, and report to members.\n\n'
                    '**People:** match tasks to skills and interests, and avoid overloading the same few members.\n\n'
                    '**Materials:** list what you need, borrow or partner where possible, and take care of the equipment.\n\n'
                    '**Time:** set a schedule with a little extra time for delays.\n\n'
                    '**Rule of thumb:** no receipt, no record, no report.'
                ),
                'questions': [
                    q('What should be done before spending the organization\'s money?', 'A budget plans what will be spent and on what.',
                      'Prepare a budget', 'Spend first and record later', 'Ask nobody', 'Hide the amount'),
                    q('Why keep receipts?', 'Receipts prove how funds were used.',
                      'They prove how the funds were used', 'They are only for decoration', 'They let you spend more', 'They replace the budget'),
                    q('How can an organization avoid overloading its members?', 'Sharing tasks fairly keeps members motivated.',
                      'Share tasks fairly based on skills and interests', 'Give everything to one member', 'Never assign tasks', 'Assign tasks only to officers'),
                    q('Why add extra time in a schedule?', 'Extra time helps the project survive delays.',
                      'To allow for delays', 'To make the project longer than necessary', 'To avoid deadlines', 'To skip planning'),
                ],
            },
        ],
    },
    {
        'title': 'Module 3: Community Engagement', 'order': 3,
        'lessons': [
            {
                'order': 1, 'title': 'Volunteer Coordination', 'duration': 20,
                'content': (
                    'Volunteers give their time because they care. Good coordination keeps them motivated.\n\n'
                    '**Recruit:** explain clearly what the activity is, what the volunteer will do, and how much time it takes.\n\n'
                    '**Orient:** give a short briefing on the goal, the schedule, the safety rules and who to ask.\n\n'
                    '**Assign:** match tasks to skills and interests, and give each volunteer a clear job.\n\n'
                    '**Support and thank:** check on volunteers, solve problems quickly and recognize their effort.\n\n'
                    '**Remember:** volunteers who feel useful and appreciated come back.'
                ),
                'questions': [
                    q('What should be explained when recruiting a volunteer?', 'Volunteers need to know the task and the time needed.',
                      'What they will do and how much time it takes', 'Nothing, they will figure it out', 'Only the date', 'Only the name of the organization'),
                    q('What is the purpose of a volunteer orientation?', 'A short briefing prepares volunteers on the goal, schedule and safety.',
                      'To brief them on the goal, schedule, safety rules and who to ask', 'To test them', 'To make them wait', 'To collect fees'),
                    q('How should tasks be assigned to volunteers?', 'Matching tasks to skills and interests helps volunteers do well and enjoy it.',
                      'Match tasks to skills and interests', 'Give everyone the hardest task', 'Assign tasks randomly without telling them', 'Let them guess'),
                    q('What helps volunteers come back?', 'People return when they feel useful and appreciated.',
                      'Feeling useful and appreciated', 'Being ignored', 'Not knowing the schedule', 'Being blamed for small mistakes'),
                ],
            },
            {
                'order': 2, 'title': 'Community Participation', 'duration': 20,
                'content': (
                    'Projects work better when the community helps shape them.\n\n'
                    '**Who is the community?** Residents, parents, schools, the barangay, local government offices, businesses and other groups.\n\n'
                    '**Ways to involve them:** hold consultations, ask for suggestions, invite them to take part in activities, and share results.\n\n'
                    '**Partnerships:** work with the barangay, schools and other organizations to share resources and reach more people.\n\n'
                    '**Tip:** report back. When people see what happened with their ideas, they take part again.'
                ),
                'questions': [
                    q('Why involve the community in a project?', 'Projects shaped by the community match their needs and get more support.',
                      'Projects match real needs and get more support', 'To avoid planning', 'To make the project secret', 'To reduce the number of participants'),
                    q('Which is a way to involve the community?', 'Consultations let residents share their views.',
                      'Hold consultations and ask for suggestions', 'Announce the project after it ends', 'Ignore residents', 'Only talk to officers'),
                    q('How can partnerships help a youth organization?', 'Partners can share resources and reach more people.',
                      'Partners share resources and reach more people', 'They remove all responsibilities', 'They make planning unnecessary', 'They stop volunteers from joining'),
                    q('Why should the organization report back to the community?', 'People take part again when they see results.',
                      'People see what happened and are likely to take part again', 'It is required only for officers', 'It prevents new projects', 'It hides the budget'),
                ],
            },
            {
                'order': 3, 'title': 'Project Evaluation', 'duration': 20,
                'content': (
                    'Evaluation shows what worked, what did not, and what to do better next time.\n\n'
                    '**Compare results with the goal:** if the goal was 100 participants and 60 came, ask why.\n\n'
                    '**Collect feedback:** use short surveys, a feedback box or a talk with participants and volunteers.\n\n'
                    '**Review the budget:** was the money used as planned?\n\n'
                    '**Write a short report** with results, lessons learned and recommendations, and share it with members and partners.\n\n'
                    '**Remember:** evaluation is for learning, not for blaming.'
                ),
                'questions': [
                    q('What is the main purpose of project evaluation?', 'Evaluation shows what worked and what to improve next time.',
                      'To learn what worked and what to improve', 'To find someone to blame', 'To avoid future projects', 'To hide results'),
                    q('How can a project\'s results be judged?', 'Results are compared with the original goal.',
                      'By comparing the results with the goal', 'By the weather only', 'By guessing', 'By ignoring participants'),
                    q('Which is a way to collect feedback?', 'Short surveys and conversations give useful feedback.',
                      'A short survey or a feedback box', 'Throwing the comments away', 'Asking only the officers', 'Never asking'),
                    q('What should an evaluation report include?', 'Results, lessons learned and recommendations help the next project.',
                      'Results, lessons learned and recommendations', 'Only the names of the volunteers', 'Nothing', 'Only photos'),
                ],
            },
        ],
    },
]
