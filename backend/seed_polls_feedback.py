"""
Run with: python seed_polls_feedback.py
Creates sample poll questions with options and feedback entries.
"""
import os
import sys
import django
from datetime import timedelta

sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.utils import timezone
from apps.accounts.models import User
from apps.events.models import Poll, PollOption, Feedback, Event

# ── Get a seed user (admin or first available) ─────────────────────────────
admin = User.objects.filter(email='adminako@gmail.com').first() or User.objects.first()
if not admin:
    print("No users found — run the main seed script first.")
    sys.exit(1)

# ── Polls ──────────────────────────────────────────────────────────────────
POLLS = [
    {
        'question': 'What type of youth programs would you like to see more of in Lucena City?',
        'options': [
            'Leadership & Governance Training',
            'Skills & Livelihood Programs',
            'Sports & Recreation Activities',
            'Arts, Culture & Heritage Programs',
        ],
        'days_left': 14,
    },
    {
        'question': 'How often do you participate in SK-organized community activities?',
        'options': [
            'Every time there\'s an event',
            'Occasionally (2–3 times a year)',
            'Rarely (once a year or less)',
            'I haven\'t participated yet',
        ],
        'days_left': 7,
    },
    {
        'question': 'Which platform do you prefer for receiving news and updates from LYDO?',
        'options': [
            'Facebook / Social Media',
            'This LYDO Hub portal',
            'SMS / Text Notifications',
            'Barangay Bulletin Boards',
        ],
        'days_left': 10,
    },
    {
        'question': 'What is the biggest challenge you face as a young person in Lucena City?',
        'options': [
            'Lack of job & livelihood opportunities',
            'Limited access to quality education',
            'Mental health & wellness support',
            'Limited participation in governance',
        ],
        'days_left': 21,
    },
    {
        'question': 'How satisfied are you with the current services provided by the Sangguniang Kabataan?',
        'options': [
            'Very satisfied',
            'Satisfied',
            'Neutral',
            'Not satisfied',
        ],
        'days_left': 30,
    },
]

created_polls = 0
for p in POLLS:
    poll, created = Poll.objects.get_or_create(
        question=p['question'],
        defaults={
            'created_by': admin,
            'is_active': True,
            'ends_at': timezone.now() + timedelta(days=p['days_left']),
        }
    )
    if created:
        for order, option_text in enumerate(p['options'], start=1):
            PollOption.objects.get_or_create(poll=poll, text=option_text, defaults={'order': order})
        created_polls += 1

print(f"Polls: {created_polls} created, {len(POLLS) - created_polls} already existed.")

# ── Feedback ───────────────────────────────────────────────────────────────
events = list(Event.objects.all()[:5])
users = list(User.objects.filter(role='youth')[:10])

if not users:
    users = list(User.objects.all()[:5])

FEEDBACK_ENTRIES = [
    (5, "The program was extremely well organized. I learned so much about leadership and community service. Highly recommend to all youth!"),
    (4, "Great event overall. The speakers were knowledgeable and inspiring. Would have liked more interactive activities though."),
    (5, "This is exactly the kind of initiative we need in Lucena. More events like this please! The LYDO team did an amazing job."),
    (3, "The content was good but the venue was a bit small. Hope future events can accommodate more participants."),
    (4, "Very informative and well-structured. I appreciated the practical tips shared by the resource speakers."),
    (5, "One of the best youth development programs I've attended. The facilitators were engaging and made everything easy to understand."),
    (2, "The schedule was disorganized and there were long delays. Content was okay but the logistics need improvement."),
    (4, "Learned a lot about governance and how youth can participate in local government. Would attend again."),
    (5, "Incredible experience! Met so many inspiring young leaders from different barangays. The networking alone was worth it."),
    (3, "Decent program. The modules were informative but felt a bit rushed. Maybe split into two sessions next time."),
    (4, "Really appreciated that LYDO included mental health as a topic. More awareness programs like this are needed."),
    (5, "The SK orientation was super helpful. Now I have a clear understanding of my responsibilities as a youth leader."),
]

created_fb = 0
for i, (rating, comment) in enumerate(FEEDBACK_ENTRIES):
    if not users:
        break
    user = users[i % len(users)]
    event = events[i % len(events)] if events else None

    _, created = Feedback.objects.get_or_create(
        user=user,
        event=event,
        defaults={'rating': rating, 'comment': comment}
    )
    if created:
        created_fb += 1

print(f"Feedback: {created_fb} created, {len(FEEDBACK_ENTRIES) - created_fb} already existed.")
print("Done!")
