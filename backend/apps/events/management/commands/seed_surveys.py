"""
Add ready-made surveys for the youth and repair survey questions that have no answer choices. Idempotent:

    python manage.py seed_surveys

* Repairs: a multiple-choice question with no choices cannot be answered, so the youth could not go to the next question.
  The two seeded surveys had this. Their questions now get proper choices (or become Yes / No).
* New surveys: opinion and preference questions only. They state no facts, dates, amounts or policies. A survey that
  already exists (same title) is not added again. LYDO can switch any of them off in the admin panel.
Surveys are saved in the name of the first LYDO administrator account.
"""
from django.core.management.base import BaseCommand, CommandError

from apps.accounts.models import User
from apps.events.models import Survey, SurveyQuestion

R, S, Y, M, T = "rating", "scale", "yes_no", "multiple_choice", "text"

# question text -> (type, choices): used to repair questions that were saved without choices
REPAIRS = {
    "Which area should LYDO focus on most in 2025?": (M, [
        "Jobs and livelihood", "Education and scholarships", "Mental health and well-being",
        "Environment and clean-up", "Sports and recreation", "Youth participation in governance"]),
    "Would you attend again next year?": (Y, []),
}

SURVEYS = [
    ("Youth Programs Satisfaction Survey", "Tell us how LYDO programs are working for you. Takes about 3 minutes.", [
        ("How satisfied are you with the programs of LYDO so far?", R, []),
        ("Which kind of program have you joined?", M, ["Training or workshop", "Sports activity", "Community service", "Leadership program", "I have not joined one yet"]),
        ("How easy is it to find out about new programs?", S, []),
        ("Would you recommend LYDO programs to a friend?", Y, []),
        ("What should LYDO improve first?", T, []),
    ]),
    ("Jobs and Livelihood Needs Survey", "Help LYDO plan better job and livelihood support for the youth of Lucena.", [
        ("What is your situation right now?", M, ["Studying", "Looking for a job", "Working", "Working and studying", "Starting a small business"]),
        ("What kind of work are you most interested in?", M, ["Office or administrative", "Technology and online work", "Food, tourism and hospitality", "Skilled trades and technical work", "Business or entrepreneurship", "Government service"]),
        ("What would help you get a job the most?", M, ["Free skills training", "Job openings in one place", "Resume and interview coaching", "Internship or OJT", "Business start-up guidance"]),
        ("Would you join a job fair held in Lucena?", Y, []),
        ("How confident are you in your job-hunting skills?", S, []),
        ("Anything else LYDO should know about jobs for the youth?", T, []),
    ]),
    ("Education and Scholarship Survey", "Your answers help LYDO understand what students need.", [
        ("What is your current level of education?", M, ["Senior high school", "College", "Technical-vocational", "Out of school", "Graduate studies"]),
        ("What is your biggest challenge in your studies?", M, ["Tuition and fees", "Books and supplies", "Internet and devices", "Transportation", "Time and balancing work"]),
        ("Have you applied for a scholarship before?", Y, []),
        ("How easy was it to understand the requirements of scholarships?", R, []),
        ("What kind of support would help you the most?", T, []),
    ]),
    ("Platform Feedback: LYDOP Experience", "Tell us about your experience using this platform so we can make it better.", [
        ("Overall, how would you rate this platform?", R, []),
        ("Which part of the platform do you use the most?", M, ["Learn (courses)", "Opportunities (jobs, scholarships, schools)", "Events and calendar", "Community", "News and announcements"]),
        ("How easy is the platform to use?", S, []),
        ("Did you find what you were looking for?", Y, []),
        ("What feature would you like us to add?", T, []),
    ]),
    ("Barangay Youth Concerns Survey", "Share the concerns of the youth in your barangay. SK and LYDO will use this to plan.", [
        ("What is the biggest concern of the youth in your barangay?", M, ["Lack of activities", "Lack of safe places to gather", "Jobs and income", "Education costs", "Vices and peer pressure", "Environment and cleanliness"]),
        ("How active is the SK in your barangay?", R, []),
        ("Do you know who your SK Chairperson is?", Y, []),
        ("How much do you feel the youth are heard in your barangay?", S, []),
        ("What project would you like your barangay to do for the youth?", T, []),
    ]),
    ("Events and Activities Interest Survey", "Help LYDO choose events you will enjoy.", [
        ("Which kind of event would you attend?", M, ["Sports and fun runs", "Workshops and trainings", "Arts and music", "Community clean-up and volunteering", "Leadership summit", "Talks and webinars"]),
        ("How many events would you like to attend in a year?", M, ["1 to 2", "3 to 5", "6 to 10", "More than 10"]),
        ("How likely are you to invite a friend to an event?", S, []),
        ("Do you prefer events that are free?", Y, []),
        ("What would make events better?", T, []),
    ]),
    ("Learning and Skills Interest Survey", "Tell LYDO which skills and courses you want in the Learn section.", [
        ("Which skill do you want to learn next?", M, ["Computer and digital skills", "Communication and public speaking", "Leadership and teamwork", "Financial literacy", "Entrepreneurship", "Government and civic knowledge"]),
        ("How do you prefer to learn?", M, ["Short videos", "Reading", "Quizzes and activities", "Live classes", "A mix of everything"]),
        ("How would you rate the courses you have tried?", R, []),
        ("Would you finish a course to earn a certificate?", Y, []),
        ("Which topic should be added to the courses?", T, []),
    ]),
]


class Command(BaseCommand):
    help = "Add ready-made surveys and repair survey questions that have no choices (no duplicates)."

    def handle(self, *args, **opts):
        admin = User.objects.filter(role__in=["lgu_admin", "super_admin"], is_active=True).order_by("id").first()
        if admin is None:
            raise CommandError("Create a LYDO administrator account first. Surveys are saved in an administrator's name.")

        repaired = 0
        for q in SurveyQuestion.objects.filter(question_type=M):
            if q.choices:
                continue
            fix = REPAIRS.get(q.question.strip())
            if fix:
                q.question_type, q.choices = fix[0], fix[1]
            else:
                q.question_type = T  # no choices known: let the person write the answer instead of being stuck
            q.save(update_fields=["question_type", "choices"])
            repaired += 1

        added = 0
        for title, description, questions in SURVEYS:
            if Survey.objects.filter(title=title).exists():
                continue
            survey = Survey.objects.create(title=title, description=description, created_by=admin, is_active=True)
            for i, (text, qtype, choices) in enumerate(questions, start=1):
                SurveyQuestion.objects.create(survey=survey, question=text, question_type=qtype, choices=choices, order=i)
            added += 1
        self.stdout.write(f"{added} survey(s) added, {len(SURVEYS) - added} already there. {repaired} question(s) repaired.")
