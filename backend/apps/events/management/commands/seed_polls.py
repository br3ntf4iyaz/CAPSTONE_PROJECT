"""
Add ready-made opinion polls for the youth of Lucena (idempotent: a poll with the same question is never added twice).

    python manage.py seed_polls

These are questions of opinion and preference only. They state no facts, dates, amounts or policies. LYDO can switch any of
them off, or add more, in the admin panel. Polls are created in the name of the first LYDO administrator account.
"""
from django.core.management.base import BaseCommand, CommandError

from apps.accounts.models import User
from apps.events.models import Poll, PollOption

POLLS = [
    ("What kind of youth activity would you join most?",
     ["Sports and fitness", "Skills training and workshops", "Community service and clean-up drives", "Arts, music and culture", "Leadership camps"]),
    ("Which day of the week is best for youth events?",
     ["Weekday afternoon", "Saturday morning", "Saturday afternoon", "Sunday afternoon"]),
    ("What time of day works best for you to attend an event?",
     ["Morning", "Afternoon", "Evening", "It depends on the event"]),
    ("What skill would you like LYDO to teach next?",
     ["Digital and computer skills", "Public speaking and communication", "Money management and entrepreneurship", "Job interview and resume writing", "Leadership and teamwork"]),
    ("Which topic should LYDO focus on this year?",
     ["Jobs and livelihood", "Education and scholarships", "Mental health and well-being", "Environment and clean-up", "Sports and recreation", "Youth participation in governance"]),
    ("How do you prefer to hear about LYDO news and events?",
     ["Notifications in this platform", "Facebook page", "Posters in my barangay or school", "Through my SK officials", "Text message"]),
    ("Which kind of scholarship support helps you most?",
     ["Tuition support", "Monthly allowance", "Books and school supplies", "Internet and device support", "Transportation"]),
    ("What kind of job help do you need most?",
     ["Finding job openings", "Free job-skills training", "Resume and interview coaching", "Internships and OJT", "Starting my own small business"]),
    ("How comfortable are you with taking an online course on this platform?",
     ["Very comfortable", "Somewhat comfortable", "I need a little guidance", "I prefer face-to-face learning"]),
    ("How often would you like to join community activities?",
     ["Every week", "Twice a month", "Once a month", "A few times a year"]),
    ("Which of these would make your barangay better for the youth?",
     ["Safe sports courts and parks", "Free Wi-Fi and study areas", "More youth programs and trainings", "Cleaner and greener spaces", "Stronger SK projects"]),
    ("What would make you more active in your SK or youth organization?",
     ["Clearer announcements", "More activities I enjoy", "A voice in decisions", "Recognition for volunteers", "Training for leaders"]),
    ("Should LYDO hold its next youth summit online, in person, or both?",
     ["In person", "Online", "Both, so I can choose"]),
    ("What stops you most from joining youth activities?",
     ["No time because of school or work", "I did not know about them", "Transportation or distance", "Cost", "I am not sure it is for me"]),
]


class Command(BaseCommand):
    help = "Add ready-made opinion polls for the youth (no duplicates)."

    def handle(self, *args, **opts):
        admin = User.objects.filter(role__in=["lgu_admin", "super_admin"], is_active=True).order_by("id").first()
        if admin is None:
            raise CommandError("Create a LYDO administrator account first. Polls are saved in an administrator's name.")
        added = 0
        for question, options in POLLS:
            if Poll.objects.filter(question=question).exists():
                continue
            poll = Poll.objects.create(question=question, created_by=admin, is_active=True)
            for i, text in enumerate(options):
                PollOption.objects.create(poll=poll, text=text, order=i)
            added += 1
        self.stdout.write(f"{added} poll(s) added, {len(POLLS) - added} already there.")
