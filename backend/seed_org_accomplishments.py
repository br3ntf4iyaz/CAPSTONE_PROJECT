"""Run with: python seed_org_accomplishments.py"""
import os, sys, django
from datetime import date

sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.youth_orgs.models import YouthOrganization, OrgAccomplishment

DATA = {
    'Lucena City National High School Student Council': [
        ('Brigada Eskwela 2024', 'Mobilized 200+ student volunteers for school cleanup and painting before the school year opened.', date(2024, 6, 3)),
        ('Mental Health Week Campaign', 'Organized a week-long awareness campaign featuring talks, art therapy, and peer support sessions.', date(2024, 2, 14)),
        ('Nutrition Month Fair', 'Hosted a nutrition awareness fair with cooking demonstrations and free health checks for students.', date(2023, 7, 25)),
    ],
    'University of Lucena Youth Alliance': [
        ('LYDO Partnership MOA Signing', 'Signed a memorandum of agreement with LYDO for youth program co-implementation and volunteer mobilization.', date(2024, 3, 10)),
        ('Coastal Cleanup Drive — Dalahican Port', 'Led a 3-hour coastal cleanup with 150 student volunteers collecting over 400 kg of waste.', date(2024, 4, 22)),
        ('Youth Leadership Summit 2024', 'Organized a one-day leadership summit for 300 students from 8 local universities.', date(2024, 1, 27)),
    ],
    'Lucena Youth Environmental Network': [
        ('Zero Waste Quezon Campaign', 'Partnered with the city government to promote zero-waste practices in 15 barangays across Lucena.', date(2024, 5, 5)),
        ('Mangrove Planting at Cotta Beach', 'Planted 1,000 mangrove seedlings along Cotta Beach to protect coastal ecosystems.', date(2023, 11, 15)),
        ('School Eco-Warriors Training', 'Trained 80 student eco-warriors from 10 schools on waste segregation and upcycling techniques.', date(2023, 9, 20)),
    ],
    'Lucena City Youth Sports Federation': [
        ('Inter-Barangay Basketball League 2024', 'Successfully ran a 6-week basketball tournament with 24 teams from all barangays of Lucena City.', date(2024, 3, 30)),
        ('Palarong Pambansa Qualifier', 'Fielded 40 youth athletes for the regional Palarong Pambansa qualifier — 12 advanced to regionals.', date(2024, 2, 18)),
        ('Free Sports Clinic for Youth', 'Organized free basketball and volleyball clinics attended by over 350 young athletes.', date(2023, 10, 14)),
    ],
    'Young Entrepreneurs of Lucena': [
        ('Youth Startup Expo 2024', 'Showcased 20 youth-led businesses to local investors and government officials at the Lucena City Convention Center.', date(2024, 4, 5)),
        ('Livelihood Training — Food Processing', 'Conducted hands-on food processing and packaging training for 60 out-of-school youth.', date(2023, 8, 10)),
    ],
    'Catholic Youth Organization — Lucena Diocese': [
        ('World Youth Day Pilgrimage', 'Sent 30 youth delegates to represent the Lucena Diocese in the national World Youth Day celebration.', date(2023, 7, 28)),
        ('Habagat Relief Operations', 'Distributed relief goods to 200 families affected by typhoon flooding in low-lying barangays.', date(2024, 6, 20)),
        ('Summer Catechism Program', 'Facilitated a month-long Catechism summer program attended by 500+ children from 12 parishes.', date(2024, 4, 1)),
    ],
    'Gawad Kalinga Youth Volunteers — Lucena': [
        ('Bahay Kubo Build Project — Brgy. 11', 'Built 5 homes for indigent families in Barangay 11 over a 3-day community build weekend.', date(2024, 1, 13)),
        ('Livelihood Fair for Marginalized Communities', 'Organized a livelihood fair connecting 120 beneficiaries with skills training and micro-loan opportunities.', date(2023, 9, 5)),
    ],
    'Kabataang Artisano ng Lucena': [
        ('Lucena Cityhood Anniversary Art Installation', 'Created a 30-meter mural showcasing Lucena City\'s history, displayed at the city plaza during the anniversary celebration.', date(2024, 3, 22)),
        ('Indigenous Crafts Workshop Series', 'Ran 4 monthly workshops teaching traditional weaving and bamboo craft to 80 youth participants.', date(2023, 10, 8)),
    ],
}

created = 0
for org_name, activities in DATA.items():
    try:
        org = YouthOrganization.objects.get(name=org_name)
    except YouthOrganization.DoesNotExist:
        print(f'  Skipping (not found): {org_name}')
        continue
    for title, description, date_achieved in activities:
        _, was_created = OrgAccomplishment.objects.get_or_create(
            organization=org, title=title,
            defaults={'description': description, 'date_achieved': date_achieved},
        )
        if was_created:
            created += 1

print(f'Accomplishments: {created} created.')
print('Done!')
