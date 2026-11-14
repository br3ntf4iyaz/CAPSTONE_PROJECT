"""Seed Lucena City schools (public, private, state university, tech-voc).

Idempotent. Removes the old placeholder rows, and any 'community_college' rows
are converted to 'public'. Verify the list against DepEd / CHED / TESDA
directories and add anything missing through the admin or by extending LIST.
"""
from django.core.management.base import BaseCommand
from django.utils.text import slugify

from apps.schools.models import School

PLACEHOLDERS = [
    'Lucena City College', 'Kolehiyo ng Lungsod ng Lucena', 'Quezon Tech-Voc Institute',
    "Lucena Doctors' College", 'Lucena Doctors College', 'University of Perpetual Help Quezon',
    'Notre Dame College of Quezon',
]

# (name, type, address, description)
LIST = [
    # State / local colleges and universities
    ('Southern Luzon State University - Lucena Campus', 'state_university', 'Lucena City, Quezon', 'State university campus serving Lucena and Quezon Province.'),
    ('Dalubhasaan ng Lungsod ng Lucena', 'public', 'Lucena City, Quezon', 'City-run college of the Lucena City government.'),
    # Private colleges and universities
    ('Manuel S. Enverga University Foundation (MSEUF)', 'private', 'Luis Palad St., Lucena City, Quezon', 'Largest private university in Lucena; basic education to graduate programs.'),
    ('Sacred Heart College', 'private', 'Lucena City, Quezon', 'Catholic school in Lucena City offering basic education and college programs.'),
    ('Maryhill College', 'private', 'Lucena City, Quezon', 'Private college in Lucena City.'),
    ('St. Anne College Lucena', 'private', 'Lucena City, Quezon', 'Private college in Lucena City.'),
    ('ABE International College of Business and Economics', 'private', 'Lucena City, Quezon', 'Private college offering business and economics programs.'),
    ('Columbus College - Lucena', 'private', 'Lucena City, Quezon', 'Private college in Lucena City.'),
    ('AMA Computer College - Lucena', 'private', 'Lucena City, Quezon', 'Computer and IT-focused college.'),
    ('STI College Lucena', 'private', 'Lucena City, Quezon', 'Technology-focused college offering IT, business and hospitality programs.'),
    # Technical-vocational
    ('Philtech Institute of Arts and Technology Inc. (PIAT)', 'technical_vocational', 'Lucena City, Quezon', 'Technical-vocational institute.'),
    ('TESDA Quezon Provincial Training Center', 'technical_vocational', 'Lucena City, Quezon', 'TESDA training center offering technical-vocational courses.'),
    # Public high schools
    ('Quezon National High School', 'public', 'Lucena City, Quezon', 'One of the largest public high schools in Quezon Province.'),
    ('Lucena City National High School', 'public', 'Lucena City, Quezon', 'Public secondary school.'),
    ('Dalahican National High School', 'public', 'Brgy. Dalahican, Lucena City', 'Public secondary school.'),
    ('Cotta National High School', 'public', 'Brgy. Cotta, Lucena City', 'Public secondary school.'),
    ('Gulang-Gulang National High School', 'public', 'Brgy. Gulang-Gulang, Lucena City', 'Public secondary school.'),
    ('Isabang National High School', 'public', 'Brgy. Isabang, Lucena City', 'Public secondary school.'),
    ('Lucena East National High School', 'public', 'Lucena City, Quezon', 'Public secondary school.'),
    ('Mayao National High School', 'public', 'Brgy. Mayao, Lucena City', 'Public secondary school.'),
    # Private basic education
    ('Holy Rosary Catholic School (HRCS)', 'private', 'Lucena City, Quezon', 'Private Catholic school.'),
    ('Bristol Integrated School', 'private', 'Lucena City, Quezon', 'Private integrated school.'),
    ('Infant Jesus Montessori Center Philippines', 'private', 'Lucena City, Quezon', 'Private Montessori school.'),
    ('St. Philomena School', 'private', 'Lucena City, Quezon', 'Private school.'),
    ('International School for Better Beginnings (ISBB)', 'private', 'Lucena City, Quezon', 'Private school.'),
]


class Command(BaseCommand):
    help = 'Seed Lucena City schools and retire the community-college type.'

    def handle(self, *args, **opts):
        School.objects.filter(name__in=PLACEHOLDERS).delete()
        School.objects.filter(school_type='community_college').update(school_type='public')
        for name, stype, addr, desc in LIST:
            School.objects.update_or_create(
                slug=slugify(name),
                defaults=dict(name=name, school_type=stype, address=addr, description=desc,
                              municipality='Lucena City', province='Quezon', region='CALABARZON', is_active=True),
            )
        self.stdout.write(self.style.SUCCESS(f'{School.objects.count()} schools in database'))
