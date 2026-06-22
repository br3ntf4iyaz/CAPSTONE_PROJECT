"""
Management command: seed_courses
Usage: python manage.py seed_courses

Idempotent — safe to run multiple times. Uses get_or_create on Course slug.
"""
from django.core.management.base import BaseCommand
from django.utils.text import slugify

from apps.courses.models import Course, CourseModule, Lesson, Question, QuestionChoice


COURSES_DATA = [
    {
        'title': 'SK Governance Fundamentals',
        'slug': 'sk-governance-fundamentals',
        'description': (
            'Learn the foundations of Sangguniang Kabataan governance, '
            'your roles, responsibilities, and how to lead your community effectively.'
        ),
        'category': 'governance',
        'duration_hours': 2,
        'is_published': True,
        'modules': [
            {
                'title': 'Introduction to the SK',
                'order': 1,
                'lessons': [
                    {
                        'title': 'What is the Sangguniang Kabataan?',
                        'order': 1,
                        'video_url': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                        'duration_minutes': 15,
                        'content': (
                            'The Sangguniang Kabataan (SK) is the official youth organization in every barangay '
                            'in the Philippines. Established under Republic Act 10742 (SK Reform Act of 2015), '
                            'the SK is composed of youth leaders aged 18â€“24 who are elected by their fellow youth '
                            'to represent and serve their community.\n\n'
                            '**Key Facts:**\n'
                            '- The SK is composed of a Chairperson and 7 Kagawad members\n'
                            '- The SK Chairperson is an ex-officio member of the Barangay Council\n'
                            '- SK officials serve a 3-year term\n'
                            '- The SK receives 10% of the barangay\'s annual budget (the SK Fund)'
                        ),
                        'questions': [
                            {
                                'text': 'What law governs the Sangguniang Kabataan?',
                                'order': 1,
                                'explanation': (
                                    'RA 10742, the SK Reform Act of 2015, is the primary law governing the SK. '
                                    'It replaced the old SKKF law and strengthened SK governance.'
                                ),
                                'choices': [
                                    {'text': 'RA 10742', 'is_correct': True, 'order': 1},
                                    {'text': 'RA 8044', 'is_correct': False, 'order': 2},
                                    {'text': 'RA 9344', 'is_correct': False, 'order': 3},
                                    {'text': 'RA 7610', 'is_correct': False, 'order': 4},
                                ],
                            },
                            {
                                'text': 'How many members does the SK have including the Chairperson?',
                                'order': 2,
                                'explanation': (
                                    'The SK consists of a Chairperson and 7 Kagawad members, '
                                    'totaling 8 elected officials per barangay.'
                                ),
                                'choices': [
                                    {'text': '5', 'is_correct': False, 'order': 1},
                                    {'text': '7', 'is_correct': False, 'order': 2},
                                    {'text': '8', 'is_correct': True, 'order': 3},
                                    {'text': '10', 'is_correct': False, 'order': 4},
                                ],
                            },
                            {
                                'text': 'What percentage of the barangay budget is allocated to the SK?',
                                'order': 3,
                                'explanation': (
                                    'Under RA 10742, 10% of the barangay\'s annual budget is set aside '
                                    'as the SK Fund for youth programs.'
                                ),
                                'choices': [
                                    {'text': '5%', 'is_correct': False, 'order': 1},
                                    {'text': '10%', 'is_correct': True, 'order': 2},
                                    {'text': '15%', 'is_correct': False, 'order': 3},
                                    {'text': '20%', 'is_correct': False, 'order': 4},
                                ],
                            },
                        ],
                    },
                    {
                        'title': 'SK Roles and Responsibilities',
                        'order': 2,
                        'video_url': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                        'duration_minutes': 20,
                        'content': (
                            'As an SK official, you have specific duties both as a youth representative '
                            'and as part of barangay governance.\n\n'
                            '**SK Chairperson:**\n'
                            '- Presides over SK sessions\n'
                            '- Ex-officio member of the Sangguniang Barangay\n'
                            '- Signs all SK resolutions and ordinances\n'
                            '- Responsible for implementing SK programs\n\n'
                            '**SK Kagawad:**\n'
                            '- Attends and participates in SK sessions\n'
                            '- Committees: health, education, livelihood, sports, etc.\n'
                            '- Assists in program implementation\n\n'
                            '**The Annual Katipunan ng Kabataan (AKK):**\n'
                            '- General assembly of all registered youth voters\n'
                            '- Held once a year\n'
                            '- Discusses and approves the SK Annual Work and Financial Plan'
                        ),
                        'questions': [
                            {
                                'text': 'Who presides over SK sessions?',
                                'order': 1,
                                'explanation': (
                                    'The SK Chairperson presides over all SK sessions '
                                    'as the head of the youth council.'
                                ),
                                'choices': [
                                    {'text': 'Barangay Captain', 'is_correct': False, 'order': 1},
                                    {'text': 'SK Chairperson', 'is_correct': True, 'order': 2},
                                    {'text': 'Mayor', 'is_correct': False, 'order': 3},
                                    {'text': 'Oldest SK Kagawad', 'is_correct': False, 'order': 4},
                                ],
                            },
                            {
                                'text': 'What is the AKK?',
                                'order': 2,
                                'explanation': (
                                    'The AKK (Annual Katipunan ng Kabataan) is the general assembly of '
                                    'registered youth voters in the barangay, held once a year.'
                                ),
                                'choices': [
                                    {'text': 'Anti-Kabataan Kumite', 'is_correct': False, 'order': 1},
                                    {'text': 'Annual Kabataan Kumperensya', 'is_correct': False, 'order': 2},
                                    {'text': 'Annual Katipunan ng Kabataan', 'is_correct': True, 'order': 3},
                                    {'text': 'Araw ng Kabataan Komunidad', 'is_correct': False, 'order': 4},
                                ],
                            },
                            {
                                'text': 'The SK Chairperson is an ex-officio member of which body?',
                                'order': 3,
                                'explanation': (
                                    'The SK Chairperson automatically becomes a member of the '
                                    'Sangguniang Barangay (Barangay Council) as an ex-officio member.'
                                ),
                                'choices': [
                                    {'text': 'City Council', 'is_correct': False, 'order': 1},
                                    {'text': 'Barangay Council', 'is_correct': True, 'order': 2},
                                    {'text': 'Provincial Board', 'is_correct': False, 'order': 3},
                                    {'text': 'DILG', 'is_correct': False, 'order': 4},
                                ],
                            },
                        ],
                    },
                ],
            },
            {
                'title': 'SK Budget and Finance',
                'order': 2,
                'lessons': [
                    {
                        'title': 'Understanding the SK Fund',
                        'order': 1,
                        'video_url': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                        'duration_minutes': 25,
                        'content': (
                            'The SK Fund is your most important resource as an SK official. '
                            'Managing it properly is both a legal requirement and a moral responsibility.\n\n'
                            '**SK Fund Sources:**\n'
                            '- 10% of barangay annual budget (mandatory)\n'
                            '- Special levies authorized by the Sangguniang Bayan/Panlungsod\n'
                            '- Donations and grants (properly receipted)\n\n'
                            '**How the SK Fund is Allocated:**\n'
                            '- 10% of SK Fund â†’ Sangguniang Kabataan Federation (SKF) share\n'
                            '- The remaining 90% is managed by the barangay SK\n\n'
                            '**Priority Programs:**\n'
                            '- Education and training\n'
                            '- Health programs\n'
                            '- Livelihood training\n'
                            '- Sports and recreation\n'
                            '- Environmental programs\n\n'
                            '**Important Rules:**\n'
                            '- All expenditures must have proper documentation\n'
                            '- COA (Commission on Audit) audits SK funds annually\n'
                            '- Misuse of SK funds is a criminal offense'
                        ),
                        'questions': [
                            {
                                'text': "What percentage of the barangay's annual budget goes to the SK?",
                                'order': 1,
                                'explanation': (
                                    "RA 10742 mandates that 10% of the barangay's annual budget "
                                    'be allocated to the SK as their Special Fund.'
                                ),
                                'choices': [
                                    {'text': '5%', 'is_correct': False, 'order': 1},
                                    {'text': '8%', 'is_correct': False, 'order': 2},
                                    {'text': '10%', 'is_correct': True, 'order': 3},
                                    {'text': '12%', 'is_correct': False, 'order': 4},
                                ],
                            },
                            {
                                'text': 'Which government body audits SK funds?',
                                'order': 2,
                                'explanation': (
                                    'The Commission on Audit (COA) is responsible for auditing '
                                    'all government funds, including SK funds.'
                                ),
                                'choices': [
                                    {'text': 'DILG', 'is_correct': False, 'order': 1},
                                    {'text': 'DBM', 'is_correct': False, 'order': 2},
                                    {'text': 'COA', 'is_correct': True, 'order': 3},
                                    {'text': 'DOF', 'is_correct': False, 'order': 4},
                                ],
                            },
                            {
                                'text': 'What happens to 10% of the SK Fund?',
                                'order': 3,
                                'explanation': (
                                    "10% of the SK's fund allocation is remitted to the "
                                    'Sangguniang Kabataan Federation (SKF) at the municipal/city level.'
                                ),
                                'choices': [
                                    {'text': 'Goes to the Mayor', 'is_correct': False, 'order': 1},
                                    {'text': 'Goes to the SKF (Federation)', 'is_correct': True, 'order': 2},
                                    {'text': 'Returned to the barangay', 'is_correct': False, 'order': 3},
                                    {'text': 'Goes to DILG', 'is_correct': False, 'order': 4},
                                ],
                            },
                        ],
                    },
                ],
            },
        ],
    },
    {
        'title': 'Youth Leadership and Communication',
        'slug': 'youth-leadership-communication',
        'description': (
            'Develop essential leadership skills including effective communication, '
            'team building, and community organizing as a youth leader.'
        ),
        'category': 'leadership',
        'duration_hours': 1,
        'is_published': True,
        'modules': [
            {
                'title': 'Foundations of Leadership',
                'order': 1,
                'lessons': [
                    {
                        'title': 'What Makes a Great Youth Leader?',
                        'order': 1,
                        'video_url': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                        'duration_minutes': 20,
                        'content': (
                            "Leadership is not about position — it's about influence. As a youth leader "
                            'in your community, you have the opportunity to create lasting positive change.\n\n'
                            '**Core Leadership Traits:**\n'
                            '1. **Vision** — Ability to see what could be, not just what is\n'
                            '2. **Integrity** — Doing the right thing even when no one is watching\n'
                            '3. **Empathy** — Understanding and caring for the people you serve\n'
                            '4. **Communication** — Clearly expressing ideas and listening actively\n'
                            '5. **Accountability** — Taking responsibility for decisions and outcomes\n\n'
                            '**Servant Leadership:**\n'
                            'The most effective youth leaders practice servant leadership — they lead by '
                            'serving others first. This means prioritizing the needs of your community over personal gain.\n\n'
                            '**Leadership vs. Management:**\n'
                            '- Leaders inspire and motivate\n'
                            '- Leaders focus on people and vision\n'
                            "- Leaders ask 'why' and 'what if'\n"
                            '- Managers focus on systems and processes'
                        ),
                        'questions': [
                            {
                                'text': 'What is the foundation of servant leadership?',
                                'order': 1,
                                'explanation': (
                                    'Servant leadership means leading by serving — prioritizing the needs of others '
                                    'over personal gain. This is the most effective leadership style for community organizers.'
                                ),
                                'choices': [
                                    {'text': 'Authority and power', 'is_correct': False, 'order': 1},
                                    {'text': 'Putting community needs first', 'is_correct': True, 'order': 2},
                                    {'text': 'Personal recognition', 'is_correct': False, 'order': 3},
                                    {'text': 'Strict rule enforcement', 'is_correct': False, 'order': 4},
                                ],
                            },
                            {
                                'text': 'Which of these is NOT listed as a core leadership trait?',
                                'order': 2,
                                'explanation': (
                                    'While being likeable helps, popularity is not a core leadership trait. '
                                    'Vision, integrity, empathy, communication, and accountability are the '
                                    'foundations of effective leadership.'
                                ),
                                'choices': [
                                    {'text': 'Vision', 'is_correct': False, 'order': 1},
                                    {'text': 'Empathy', 'is_correct': False, 'order': 2},
                                    {'text': 'Popularity', 'is_correct': True, 'order': 3},
                                    {'text': 'Integrity', 'is_correct': False, 'order': 4},
                                ],
                            },
                            {
                                'text': 'Leaders primarily focus on:',
                                'order': 3,
                                'explanation': (
                                    'Leaders focus on people and vision — inspiring others toward a shared goal '
                                    '— while management focuses on systems and processes.'
                                ),
                                'choices': [
                                    {'text': 'Systems and processes', 'is_correct': False, 'order': 1},
                                    {'text': 'Following rules strictly', 'is_correct': False, 'order': 2},
                                    {'text': 'People and vision', 'is_correct': True, 'order': 3},
                                    {'text': 'Budget management', 'is_correct': False, 'order': 4},
                                ],
                            },
                        ],
                    },
                    {
                        'title': 'Effective Communication for Leaders',
                        'order': 2,
                        'video_url': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                        'duration_minutes': 15,
                        'content': (
                            'Communication is the most critical skill for any leader. '
                            'How you say something is often as important as what you say.\n\n'
                            '**The 7 Cs of Effective Communication:**\n'
                            '1. **Clear** — Use simple, direct language\n'
                            '2. **Concise** — Say what you need without unnecessary words\n'
                            '3. **Concrete** — Use specific facts and examples\n'
                            '4. **Correct** — Ensure accuracy of information\n'
                            '5. **Coherent** — Ideas flow logically\n'
                            '6. **Complete** — Include all necessary information\n'
                            '7. **Courteous** — Respectful and considerate tone\n\n'
                            '**Active Listening:**\n'
                            '- Give full attention to the speaker\n'
                            '- Avoid interrupting\n'
                            '- Ask clarifying questions\n'
                            '- Paraphrase to confirm understanding\n\n'
                            '**Public Speaking Tips:**\n'
                            '- Know your audience\n'
                            '- Prepare and practice\n'
                            '- Start strong with a story or question\n'
                            '- Make eye contact\n'
                            '- Speak slowly and clearly'
                        ),
                        'questions': [
                            {
                                'text': "What does the first 'C' in the 7 Cs of Communication stand for?",
                                'order': 1,
                                'explanation': (
                                    'Clear is the first C — communication must be easy to understand, '
                                    'using simple and direct language appropriate for your audience.'
                                ),
                                'choices': [
                                    {'text': 'Concise', 'is_correct': False, 'order': 1},
                                    {'text': 'Complete', 'is_correct': False, 'order': 2},
                                    {'text': 'Clear', 'is_correct': True, 'order': 3},
                                    {'text': 'Correct', 'is_correct': False, 'order': 4},
                                ],
                            },
                            {
                                'text': 'Active listening includes:',
                                'order': 2,
                                'explanation': (
                                    "Paraphrasing what you heard ('So what you're saying is...') confirms "
                                    'understanding and shows the speaker you were truly listening.'
                                ),
                                'choices': [
                                    {'text': 'Interrupting to add your thoughts', 'is_correct': False, 'order': 1},
                                    {'text': 'Planning your response while listening', 'is_correct': False, 'order': 2},
                                    {'text': 'Paraphrasing to confirm understanding', 'is_correct': True, 'order': 3},
                                    {'text': 'Only listening to key words', 'is_correct': False, 'order': 4},
                                ],
                            },
                            {
                                'text': 'Which of these is a good public speaking tip?',
                                'order': 3,
                                'explanation': (
                                    'Starting with a compelling story or thought-provoking question immediately '
                                    'engages your audience and establishes a connection before you deliver your main message.'
                                ),
                                'choices': [
                                    {'text': 'Speak as fast as possible', 'is_correct': False, 'order': 1},
                                    {'text': 'Avoid eye contact', 'is_correct': False, 'order': 2},
                                    {'text': 'Read from your notes only', 'is_correct': False, 'order': 3},
                                    {'text': 'Start with a story or question', 'is_correct': True, 'order': 4},
                                ],
                            },
                        ],
                    },
                ],
            },
        ],
    },
]


class Command(BaseCommand):
    help = 'Seed the database with SK Governance and Youth Leadership courses.'

    def handle(self, *args, **options):
        for course_data in COURSES_DATA:
            modules_data = course_data.pop('modules')
            course, created = Course.objects.get_or_create(
                slug=course_data['slug'],
                defaults=course_data,
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'Created course: {course.title}'))
            else:
                self.stdout.write(f'Course already exists: {course.title}')

            for module_data in modules_data:
                lessons_data = module_data.pop('lessons')
                module, _ = CourseModule.objects.get_or_create(
                    course=course,
                    order=module_data['order'],
                    defaults={'title': module_data['title']},
                )

                for lesson_data in lessons_data:
                    questions_data = lesson_data.pop('questions')
                    lesson, _ = Lesson.objects.get_or_create(
                        module=module,
                        order=lesson_data['order'],
                        defaults={
                            'title': lesson_data['title'],
                            'video_url': lesson_data.get('video_url', ''),
                            'content': lesson_data.get('content', ''),
                            'duration_minutes': lesson_data.get('duration_minutes'),
                        },
                    )

                    for q_data in questions_data:
                        choices_data = q_data.pop('choices')
                        question, q_created = Question.objects.get_or_create(
                            lesson=lesson,
                            order=q_data['order'],
                            defaults={
                                'text': q_data['text'],
                                'explanation': q_data.get('explanation', ''),
                            },
                        )
                        if q_created:
                            for c_data in choices_data:
                                QuestionChoice.objects.create(question=question, **c_data)

        self.stdout.write(self.style.SUCCESS('Seeding complete.'))

