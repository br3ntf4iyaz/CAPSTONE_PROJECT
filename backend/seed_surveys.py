"""
Run with: python manage.py shell < seed_surveys.py
Creates 3 sample surveys with quantitative questions and sample responses.
"""
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

from apps.accounts.models import User
from apps.events.models import Survey, SurveyQuestion, SurveyResponse

admin = User.objects.filter(role__in=['lgu_admin', 'super_admin']).first()
if not admin:
    print("No admin user found – seed skipped"); exit()

# ─── Survey 1: Youth Services Satisfaction ───────────────────────────────────
s1, _ = Survey.objects.get_or_create(
    title="Youth Services Satisfaction Survey 2025",
    defaults={
        'description': 'Help us improve SK youth services in Lucena City by answering a few quick questions.',
        'created_by': admin,
        'is_active': True,
    }
)
if not s1.questions.exists():
    SurveyQuestion.objects.create(survey=s1, question="How satisfied are you with the SK youth programs in your barangay?", question_type='rating', choices=[], order=0)
    SurveyQuestion.objects.create(survey=s1, question="Which SK program do you find most useful?", question_type='multiple_choice', choices=["Sports and Recreation", "Scholarship Assistance", "Livelihood Training", "Health and Wellness", "Environmental Programs"], order=1)
    SurveyQuestion.objects.create(survey=s1, question="How often do you participate in SK events?", question_type='multiple_choice', choices=["Every event", "Monthly", "Occasionally", "Rarely", "Never"], order=2)
    SurveyQuestion.objects.create(survey=s1, question="Do you feel the SK listens to youth concerns?", question_type='yes_no', choices=[], order=3)
    SurveyQuestion.objects.create(survey=s1, question="On a scale of 1-10, how would you rate SK communication to the youth?", question_type='scale', choices=[], order=4)
    SurveyQuestion.objects.create(survey=s1, question="How many SK events have you attended in the last 6 months?", question_type='number', choices=[], order=5)
    print(f"✓ Created Survey 1: {s1.title} with {s1.questions.count()} questions")

# ─── Survey 2: Skills & Employment Needs ──────────────────────────────────────
s2, _ = Survey.objects.get_or_create(
    title="Youth Skills & Employment Needs Assessment",
    defaults={
        'description': 'Understanding your employment needs helps us connect you with the right opportunities.',
        'created_by': admin,
        'is_active': True,
    }
)
if not s2.questions.exists():
    SurveyQuestion.objects.create(survey=s2, question="What is your current employment status?", question_type='multiple_choice', choices=["Employed (Full-time)", "Employed (Part-time)", "Self-Employed", "Unemployed (seeking work)", "Student", "Not looking for work"], order=0)
    SurveyQuestion.objects.create(survey=s2, question="Which skills would you like to develop?", question_type='multiple_choice', choices=["Digital / Computer Skills", "Entrepreneurship", "Communication & Leadership", "Technical / Vocational", "Creative Arts", "Agriculture"], order=1)
    SurveyQuestion.objects.create(survey=s2, question="How important is finding a job to you right now?", question_type='scale', choices=[], order=2)
    SurveyQuestion.objects.create(survey=s2, question="Have you availed of any government employment program (TESDA, PESO, etc.)?", question_type='yes_no', choices=[], order=3)
    SurveyQuestion.objects.create(survey=s2, question="How satisfied are you with available job opportunities in Lucena City?", question_type='rating', choices=[], order=4)
    print(f"✓ Created Survey 2: {s2.title} with {s2.questions.count()} questions")

# ─── Survey 3: Community Issue Pulse ─────────────────────────────────────────
s3, _ = Survey.objects.get_or_create(
    title="Community Issues Pulse Check — Q2 2025",
    defaults={
        'description': 'Tell us what issues matter most to young people in your community.',
        'created_by': admin,
        'is_active': True,
    }
)
if not s3.questions.exists():
    SurveyQuestion.objects.create(survey=s3, question="What is the biggest challenge facing youth in your barangay?", question_type='multiple_choice', choices=["Lack of job opportunities", "Poor access to education", "Drug-related issues", "Lack of recreational spaces", "Peace and order concerns", "Poverty / Financial hardship"], order=0)
    SurveyQuestion.objects.create(survey=s3, question="How safe do you feel in your barangay?", question_type='scale', choices=[], order=1)
    SurveyQuestion.objects.create(survey=s3, question="Are you aware of the SK's accomplishment reports and activities?", question_type='yes_no', choices=[], order=2)
    SurveyQuestion.objects.create(survey=s3, question="How would you rate the overall condition of youth facilities in your area?", question_type='rating', choices=[], order=3)
    SurveyQuestion.objects.create(survey=s3, question="Which type of community project should SK prioritize?", question_type='multiple_choice', choices=["Livelihood / Income-generating", "Sports & Arts", "Environmental cleanup", "Health outreach", "Education support", "Infrastructure (courts, parks)"], order=4)
    print(f"✓ Created Survey 3: {s3.title} with {s3.questions.count()} questions")

# ─── Sample responses ─────────────────────────────────────────────────────────
import random
youth_users = list(User.objects.filter(role='youth')[:15])

sample_answers_s1 = [
    {str(s1.questions.all()[0].id): str(random.randint(3,5)),
     str(s1.questions.all()[1].id): random.choice(["Sports and Recreation","Scholarship Assistance","Livelihood Training"]),
     str(s1.questions.all()[2].id): random.choice(["Monthly","Occasionally","Every event"]),
     str(s1.questions.all()[3].id): random.choice(["yes","no"]),
     str(s1.questions.all()[4].id): str(random.randint(5,10)),
     str(s1.questions.all()[5].id): str(random.randint(0,8))}
    for _ in range(min(10, len(youth_users)))
]

for i, user in enumerate(youth_users[:len(sample_answers_s1)]):
    if not SurveyResponse.objects.filter(survey=s1, user=user).exists():
        SurveyResponse.objects.create(survey=s1, user=user, answers=sample_answers_s1[i])

print(f"✓ Added {SurveyResponse.objects.filter(survey=s1).count()} sample responses to Survey 1")

sample_answers_s2 = [
    {str(s2.questions.all()[0].id): random.choice(["Student","Unemployed (seeking work)","Employed (Part-time)"]),
     str(s2.questions.all()[1].id): random.choice(["Digital / Computer Skills","Entrepreneurship","Technical / Vocational"]),
     str(s2.questions.all()[2].id): str(random.randint(6,10)),
     str(s2.questions.all()[3].id): random.choice(["yes","no"]),
     str(s2.questions.all()[4].id): str(random.randint(1,4))}
    for _ in range(min(8, len(youth_users)))
]
for i, user in enumerate(youth_users[:len(sample_answers_s2)]):
    if not SurveyResponse.objects.filter(survey=s2, user=user).exists():
        SurveyResponse.objects.create(survey=s2, user=user, answers=sample_answers_s2[i])

print(f"✓ Added {SurveyResponse.objects.filter(survey=s2).count()} sample responses to Survey 2")
print("Done.")
