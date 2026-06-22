"""
Run with: python seed_youth_orgs.py
Creates sample youth organizations (excludes SK councils — those are in the SK directory).
"""
import os
import sys
import django

sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.youth_orgs.models import YouthOrganization

ORGS = [
    # School-Based
    {
        'name': 'Lucena City National High School Student Council',
        'classification': 'school_based',
        'sub_classification': 'youth_org',
        'registration_category': 'lydo',
        'barangay': 'Barangay 1',
        'description': 'The official student governing body of LCNHS, advocating for student welfare and organizing school-wide activities.',
        'contact_person': 'Maria Santos',
        'contact_email': 'lcnhssc@email.com',
        'contact_phone': '09171234567',
        'is_active': True,
        'is_compliant': True,
    },
    {
        'name': 'University of Lucena Youth Alliance',
        'classification': 'school_based',
        'sub_classification': 'youth_org',
        'registration_category': 'nyc',
        'barangay': 'Barangay 3',
        'description': 'A university-based alliance uniting students from various colleges to promote leadership, volunteerism, and civic engagement.',
        'contact_person': 'John dela Cruz',
        'contact_email': 'ulya@email.com',
        'contact_phone': '09189876543',
        'is_active': True,
        'is_compliant': True,
    },
    {
        'name': 'STI College Lucena Junior Innovators Club',
        'classification': 'school_based',
        'sub_classification': 'youth_org',
        'registration_category': 'lydo',
        'barangay': 'Barangay 5',
        'description': 'Technology-focused student organization that empowers youth through coding bootcamps, hackathons, and digital literacy programs.',
        'contact_person': 'Kevin Reyes',
        'contact_email': 'sti.jic@email.com',
        'contact_phone': '09205551234',
        'is_active': True,
        'is_compliant': False,
    },
    {
        'name': 'Quezon National High School Peer Leaders',
        'classification': 'school_based',
        'sub_classification': 'youth_serving',
        'registration_category': 'lydo',
        'barangay': 'Barangay 2',
        'description': 'A peer support and leadership group that promotes mental health awareness and positive values among high school students.',
        'contact_person': 'Ana Villanueva',
        'contact_email': 'qnhs.pl@email.com',
        'contact_phone': '09334445566',
        'is_active': True,
        'is_compliant': True,
    },
    # Community-Based
    {
        'name': 'Lucena Youth Environmental Network',
        'classification': 'community_based',
        'sub_classification': 'youth_org',
        'registration_category': 'nyc',
        'barangay': 'Barangay 7',
        'description': 'Environmental advocates dedicated to promoting sustainable practices, coastal cleanup drives, and tree-planting activities in Lucena City.',
        'contact_person': 'Paolo Andrada',
        'contact_email': 'lyen@email.com',
        'contact_phone': '09452223344',
        'is_active': True,
        'is_compliant': True,
    },
    {
        'name': 'Lucena City Youth Sports Federation',
        'classification': 'community_based',
        'sub_classification': 'youth_org',
        'registration_category': 'lydo',
        'barangay': 'Barangay 9',
        'description': 'Organizes inter-barangay sports tournaments and youth athletic programs to promote health, discipline, and sportsmanship.',
        'contact_person': 'Carlo Bautista',
        'contact_email': 'lcysf@email.com',
        'contact_phone': '09178889900',
        'is_active': True,
        'is_compliant': True,
    },
    {
        'name': 'Young Entrepreneurs of Lucena',
        'classification': 'community_based',
        'sub_classification': 'youth_org',
        'registration_category': 'lydo',
        'barangay': 'Barangay 4',
        'description': 'Empowers young entrepreneurs through business mentoring, livelihood training, and startup incubation programs.',
        'contact_person': 'Rachel Torres',
        'contact_email': 'yel.lucena@email.com',
        'contact_phone': '09231112233',
        'is_active': True,
        'is_compliant': False,
    },
    {
        'name': 'Kabataang Artisano ng Lucena',
        'classification': 'community_based',
        'sub_classification': 'youth_org',
        'registration_category': 'not_registered',
        'barangay': 'Barangay 6',
        'description': 'Celebrates local arts, crafts, and culture by organizing cultural festivals, art exhibits, and indigenous crafts workshops for the youth.',
        'contact_person': 'Sofia Lim',
        'contact_email': 'kal.arts@email.com',
        'contact_phone': '09667778899',
        'is_active': True,
        'is_compliant': False,
    },
    {
        'name': 'Lucena Youth Mental Health Advocates',
        'classification': 'community_based',
        'sub_classification': 'youth_serving',
        'registration_category': 'lydo',
        'barangay': 'Barangay 8',
        'description': 'A peer-driven mental health awareness group that provides safe spaces, free counseling referrals, and destigmatization campaigns.',
        'contact_person': 'Diane Castillo',
        'contact_email': 'lymha@email.com',
        'contact_phone': '09384446655',
        'is_active': True,
        'is_compliant': True,
    },
    # Faith-Based
    {
        'name': 'Catholic Youth Organization — Lucena Diocese',
        'classification': 'faith_based',
        'sub_classification': 'youth_org',
        'registration_category': 'nyc',
        'barangay': 'Barangay 2',
        'description': 'Faith-based youth group conducting spiritual retreats, community service, and Catechism programs for Catholic youth in Lucena City.',
        'contact_person': 'Fr. Marco Evangelista',
        'contact_email': 'cyo.lucena@email.com',
        'contact_phone': '09159998877',
        'is_active': True,
        'is_compliant': True,
    },
    {
        'name': 'Iglesia ni Cristo Youth — Lucena Locale',
        'classification': 'faith_based',
        'sub_classification': 'youth_serving',
        'registration_category': 'lydo',
        'barangay': 'Barangay 10',
        'description': 'A youth service organization focused on values formation, disaster relief assistance, and blood donation drives.',
        'contact_person': 'Mark Bello',
        'contact_email': 'inc.youth.lucena@email.com',
        'contact_phone': '09261112200',
        'is_active': True,
        'is_compliant': True,
    },
    {
        'name': 'Gawad Kalinga Youth Volunteers — Lucena',
        'classification': 'faith_based',
        'sub_classification': 'youth_serving',
        'registration_category': 'nyc',
        'barangay': 'Barangay 11',
        'description': 'Youth volunteers engaged in community building, home construction assistance, and livelihood programs for marginalized families.',
        'contact_person': 'Trisha Morales',
        'contact_email': 'gk.youth.lucena@email.com',
        'contact_phone': '09470003344',
        'is_active': True,
        'is_compliant': False,
    },
]

created = 0
for o in ORGS:
    _, was_created = YouthOrganization.objects.get_or_create(
        name=o['name'],
        defaults={k: v for k, v in o.items() if k != 'name'},
    )
    if was_created:
        created += 1

print(f"Youth Orgs: {created} created, {len(ORGS) - created} already existed.")
print("Done!")
