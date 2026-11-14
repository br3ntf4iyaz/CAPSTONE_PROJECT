"""
Demo seed data for Lucena Youth Leadership Hub.
Run: python manage.py seed_data
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import date, timedelta

User = get_user_model()


class Command(BaseCommand):
    help = "Seed demo data for Lucena Youth Leadership Hub"

    def handle(self, *args, **options):
        self.stdout.write("Seeding demo data...")
        self._users()
        self._skills_interests()
        self._badges()
        self._courses()
        from django.core.management import call_command; call_command('seed_lucena_schools')
        self._internships()
        self._events()
        self._projects()
        self._announcements()
        self._faqs()
        self._compliance_records()
        self._youth_orgs()
        self._sk_barangays()
        self._jobs()
        self._youth_programs()
        self._featured_posts()
        # Engagement / personalised data for sample users
        self._enrollments()
        self._user_badges()
        self._recognition_certificates()
        self._event_registrations()
        self._leaderboard()
        # Public content surfaces
        self._resources()
        self._surveys_polls_feedback()
        self._support_tickets()
        # Submissions
        self._org_requirements()
        self._program_submissions()
        # Other browse-worthy content
        self._volunteer_opportunities()
        self.stdout.write(self.style.SUCCESS("[OK] Seed complete!"))
        self.stdout.write("\n  Login credentials:")
        self.stdout.write("  Youth Portal  -> http://localhost:5173/")
        self.stdout.write("  Admin Portal  -> http://localhost:5173/admin/login")
        self.stdout.write("  super@lucena.gov.ph  / SuperAdmin123!")
        self.stdout.write("  admin@lucena.gov.ph  / LGUAdmin123!")
        self.stdout.write("  youth1@gmail.com     / Youth123!\n")

    # --- Users ---
    def _users(self):
        from apps.accounts.models import Profile

        users_data = [
            dict(email="super@lucena.gov.ph", first_name="Super", last_name="Admin",
                 role="super_admin", password="SuperAdmin123!", is_staff=True, is_superuser=True),
            dict(email="admin@lucena.gov.ph", first_name="Maria", last_name="Santos",
                 role="lgu_admin", password="LGUAdmin123!"),
            dict(email="youth1@gmail.com", first_name="Juan", last_name="Dela Cruz",
                 role="youth", youth_type="sk", password="Youth123!"),
            dict(email="youth2@gmail.com", first_name="Maria", last_name="Garcia",
                 role="youth", youth_type="sk", password="Youth123!"),
            dict(email="youth3@gmail.com", first_name="Pedro", last_name="Bautista",
                 role="youth", youth_type="youth_org_leader", password="Youth123!"),
            dict(email="youth4@gmail.com", first_name="Ana", last_name="Reyes",
                 role="youth", youth_type="general_youth", password="Youth123!"),
            dict(email="youth5@gmail.com", first_name="Elena", last_name="Torres",
                 role="youth", youth_type="sk", password="Youth123!"),
            dict(email="youth6@gmail.com", first_name="Carlos", last_name="Mendoza",
                 role="youth", youth_type="youth_org_leader", password="Youth123!"),
            dict(email="youth7@gmail.com", first_name="Sofia", last_name="Cruz",
                 role="youth", youth_type="general_youth", password="Youth123!"),
            dict(email="youth8@gmail.com", first_name="Miguel", last_name="Santos",
                 role="youth", youth_type="sk", password="Youth123!"),
            dict(email="youth9@gmail.com", first_name="Jasmine", last_name="Aquino",
                 role="youth", youth_type="youth_org_leader", password="Youth123!"),
            dict(email="youth10@gmail.com", first_name="Marco", last_name="Flores",
                 role="youth", youth_type="general_youth", password="Youth123!"),
        ]

        profiles_extra = {
            "super@lucena.gov.ph": dict(bio="Platform super administrator.", municipality="Lucena City", province="Quezon"),
            "admin@lucena.gov.ph": dict(bio="LGU Admin for Lucena City Youth Affairs.", barangay="Barangay 1", municipality="Lucena City", province="Quezon", lgu_name="City Government of Lucena", lgu_position="Youth Affairs Officer"),
            "youth1@gmail.com": dict(bio="SK Chairman of Barangay 1, passionate about governance and community development.", barangay="Barangay 1", municipality="Lucena City", province="Quezon", sk_position="SK Chairman", gender="Male"),
            "youth2@gmail.com": dict(bio="Active youth leader focusing on education and health programs.", barangay="Barangay 2", municipality="Lucena City", province="Quezon", sk_position="SK Kagawad", gender="Female"),
            "youth3@gmail.com": dict(bio="Environmental advocate and youth volunteer.", barangay="Barangay 3", municipality="Lucena City", province="Quezon", sk_position="SK Treasurer", gender="Male"),
            "youth4@gmail.com": dict(bio="Passionate youth advocate focused on community development.", barangay="Barangay 4", municipality="Lucena City", province="Quezon", gender="Female"),
            "youth5@gmail.com": dict(bio="SK Secretary of Barangay 9, active in health and livelihood programs.", barangay="Barangay 9", municipality="Lucena City", province="Quezon", sk_position="SK Secretary", gender="Female"),
            "youth6@gmail.com": dict(bio="Youth org leader and environmental advocate in Barra.", barangay="Barra", municipality="Lucena City", province="Quezon", gender="Male"),
            "youth7@gmail.com": dict(bio="Aspiring social worker and community volunteer in Dalahican.", barangay="Dalahican", municipality="Lucena City", province="Quezon", gender="Female"),
            "youth8@gmail.com": dict(bio="SK Kagawad of Gulang-Gulang, champion of youth sports programs.", barangay="Gulang-Gulang", municipality="Lucena City", province="Quezon", sk_position="SK Kagawad", gender="Male"),
            "youth9@gmail.com": dict(bio="Youth leader in Mayao Kanluran dedicated to skills training and livelihood.", barangay="Mayao Kanluran", municipality="Lucena City", province="Quezon", gender="Female"),
            "youth10@gmail.com": dict(bio="General youth member from Talao-Talao interested in digital governance.", barangay="Talao-Talao", municipality="Lucena City", province="Quezon", gender="Male"),
        }

        for data in users_data:
            pwd = data.pop("password")
            is_staff = data.pop("is_staff", False)
            is_superuser = data.pop("is_superuser", False)
            user, created = User.objects.get_or_create(email=data["email"], defaults=data)
            if created:
                user.set_password(pwd)
                user.is_staff = is_staff
                user.is_superuser = is_superuser
                user.onboarding_complete = True
                user.is_email_verified = True
                user.save()
                self.stdout.write(f"  Created user: {user.email}")

            profile_data = profiles_extra.get(user.email, {})
            if profile_data:
                Profile.objects.update_or_create(user=user, defaults=profile_data)

        self.stdout.write(self.style.SUCCESS("  [OK] Users seeded"))

    # --- Skills & Interests ---
    def _skills_interests(self):
        from apps.accounts.models import Skill, Interest, UserSkill, UserInterest

        skills = ["Leadership", "Communication", "Public Speaking", "Project Management",
                  "Financial Literacy", "Digital Skills", "Community Organizing",
                  "Event Planning", "Research", "Governance", "Team Building",
                  "Problem Solving", "Networking", "Advocacy", "Report Writing"]
        interests = ["Youth Development", "Education", "Environment", "Health",
                     "Sports", "Arts & Culture", "Technology", "Livelihood",
                     "Governance", "Social Services"]

        for name in skills:
            Skill.objects.get_or_create(name=name)
        for name in interests:
            Interest.objects.get_or_create(name=name)

        youth_skills = ["Leadership", "Communication", "Community Organizing", "Governance"]
        youth_interests = ["Youth Development", "Governance", "Education"]
        for email in ["youth1@gmail.com", "youth2@gmail.com", "youth3@gmail.com"]:
            try:
                user = User.objects.get(email=email)
                for sname in youth_skills:
                    skill = Skill.objects.get(name=sname)
                    UserSkill.objects.get_or_create(user=user, skill=skill)
                for iname in youth_interests:
                    interest = Interest.objects.get(name=iname)
                    UserInterest.objects.get_or_create(user=user, interest=interest)
            except User.DoesNotExist:
                pass

        self.stdout.write(self.style.SUCCESS("  [OK] Skills & Interests seeded"))

    # --- Badges ---
    def _badges(self):
        from apps.recognition.models import Badge

        badges_data = [
            dict(name="Course Completer", description="Completed your first course on the LYDO learning platform.", category="course", criteria="Complete any one course."),
            dict(name="Learning Streak", description="Completed 3 or more courses.", category="course", criteria="Complete 3 courses."),
            dict(name="Governance Star", description="Actively participated in an SK governance event or session.", category="governance", criteria="Attend at least one governance event."),
            dict(name="SK Champion", description="Outstanding SK member recognized for leadership contributions.", category="governance", criteria="Nominated by an SK admin."),
            dict(name="Project Leader", description="Led or co-led a registered community youth project.", category="project", criteria="Register and complete a community project."),
            dict(name="Community Builder", description="Participated in 3 or more community projects.", category="project", criteria="Join 3 approved community projects."),
            dict(name="Internship Ready", description="Completed your profile and uploaded all required documents.", category="internship", criteria="Complete profile to 100% and upload documents."),
            dict(name="First Steps", description="Logged in and completed the onboarding process.", category="special", criteria="Complete onboarding."),
            dict(name="Leaderboard Top 10", description="Reached the top 10 on the youth leaderboard.", category="special", criteria="Reach rank 10 or above on the leaderboard."),
        ]

        for data in badges_data:
            Badge.objects.get_or_create(name=data["name"], defaults={**data, "is_active": True})

        self.stdout.write(self.style.SUCCESS("  [OK] Badges seeded"))

    # --- Courses ---
    def _courses(self):
        from apps.courses.models import Course, CourseModule, Lesson

        try:
            instructor = User.objects.get(email="admin@lucena.gov.ph")
        except User.DoesNotExist:
            instructor = None

        courses_data = [
            dict(title="Leadership Fundamentals", category="leadership", duration_hours=8, description="Master the core principles of effective leadership in community and governance contexts.", is_published=True, is_featured=True),
            dict(title="Youth Governance 101", category="governance", duration_hours=6, description="Understand the SK system, local governance structure, and your role as a youth leader.", is_published=True, is_featured=True),
            dict(title="Communication Skills for Leaders", category="communication", duration_hours=5, description="Develop public speaking, negotiation, and written communication skills.", is_published=True),
            dict(title="Financial Literacy for SK", category="finance", duration_hours=4, description="Learn how to manage SK funds, prepare budgets, and ensure financial transparency.", is_published=True),
            dict(title="Digital Skills for Youth Leaders", category="tech", duration_hours=6, description="Leverage technology for governance, communication, and project management.", is_published=True),
        ]

        for i, data in enumerate(courses_data):
            slug = data["title"].lower().replace(" ", "-").replace("'", "")
            course, _ = Course.objects.get_or_create(
                slug=slug,
                defaults={**data, "instructor": instructor, "is_active": True}
            )

            for m in range(1, 3):
                module, _ = CourseModule.objects.get_or_create(
                    course=course, order=m,
                    defaults=dict(title=f"Module {m}: {data['title']} Part {m}", description=f"In-depth coverage of {data['title']} topics.")
                )
                for l in range(1, 4):
                    Lesson.objects.get_or_create(
                        module=module, order=l,
                        defaults=dict(
                            title=f"Lesson {l}.{m}: Core Concept {l}",
                            content=f"This lesson covers important aspects of {data['title']}. Students will learn key principles and practical applications.",
                            duration_minutes=20,
                        )
                    )

        self.stdout.write(self.style.SUCCESS("  [OK] Courses seeded"))

    # --- Schools ---
    def _schools(self):
        from apps.schools.models import School, Program, SchoolProgram

        schools_data = [
            dict(name="Lucena City College", school_type="public", municipality="Lucena City", province="Quezon", address="Quezon Ave, Lucena City", description="A public college offering quality affordable education to Lucena residents.", phone="042-797-1234", is_active=True, is_featured=True),
            dict(name="Kolehiyo ng Lungsod ng Lucena", school_type="state_university", municipality="Lucena City", province="Quezon", address="Enriquez St, Lucena City", description="State-run institution focused on governance and social sciences.", is_active=True, is_featured=True),
            dict(name="Notre Dame College of Quezon", school_type="private", municipality="Lucena City", province="Quezon", address="Diversion Road, Lucena City", description="Catholic institution known for nursing and education programs.", is_active=True),
            dict(name="STI College Lucena", school_type="private", municipality="Lucena City", province="Quezon", address="Merchan St, Lucena City", description="Technology-focused institution offering IT and hospitality programs.", is_active=True),
            dict(name="Quezon National High School", school_type="public", municipality="Lucena City", province="Quezon", address="National Rd, Lucena City", description="One of the largest public high schools in Quezon Province.", is_active=True),
            dict(name="Quezon Tech-Voc Institute", school_type="technical_vocational", municipality="Lucena City", province="Quezon", address="Industrial Zone, Lucena City", description="Technical-vocational training for skilled trades and industry.", is_active=True),
            dict(name="Lucena Doctors College", school_type="private", municipality="Lucena City", province="Quezon", address="Evangelista St, Lucena City", description="Medical and health sciences institution.", is_active=True),
            dict(name="University of Perpetual Help Quezon", school_type="private", municipality="Lucena City", province="Quezon", address="Grand Diversion Rd, Lucena City", description="Comprehensive university offering engineering, law, and business programs.", is_active=True),
        ]

        programs_data = [
            "Computer Science", "Information Technology", "Business Administration",
            "Education", "Public Administration", "Social Work", "Nursing", "Psychology",
            "Hospitality Management", "Electronics Technology", "Automotive Technology",
            "Medicine", "Pharmacy", "Engineering", "Architecture", "Law",
            "Welding Technology", "STEM Track", "ABM Track",
        ]

        for pname in programs_data:
            ptype = "undergraduate"
            if "Technology" in pname or "Welding" in pname or "Automotive" in pname or "Electronics" in pname:
                ptype = "vocational"
            if "Track" in pname:
                ptype = "short_course"
            Program.objects.get_or_create(name=pname, defaults=dict(program_type=ptype))

        school_programs = {
            "Lucena City College": ["Computer Science", "Business Administration", "Education"],
            "Kolehiyo ng Lungsod ng Lucena": ["Public Administration", "Social Work", "Education"],
            "Notre Dame College of Quezon": ["Nursing", "Education", "Psychology"],
            "STI College Lucena": ["Information Technology", "Hospitality Management"],
            "Quezon National High School": ["STEM Track", "ABM Track"],
            "Quezon Tech-Voc Institute": ["Electronics Technology", "Automotive Technology", "Welding Technology"],
            "Lucena Doctors College": ["Medicine", "Nursing", "Pharmacy"],
            "University of Perpetual Help Quezon": ["Engineering", "Architecture", "Law", "Business Administration"],
        }

        for data in schools_data:
            slug = data["name"].lower().replace(" ", "-").replace("'", "")
            school, _ = School.objects.get_or_create(slug=slug, defaults=data)
            for pname in school_programs.get(data["name"], []):
                try:
                    prog = Program.objects.get(name=pname)
                    SchoolProgram.objects.get_or_create(school=school, program=prog, defaults=dict(is_active=True, scholarship_available=True))
                except Program.DoesNotExist:
                    pass

        self.stdout.write(self.style.SUCCESS("  [OK] Schools seeded"))

    # --- Internships ---
    def _internships(self):
        from apps.internships.models import Internship

        try:
            admin = User.objects.get(email="admin@lucena.gov.ph")
        except User.DoesNotExist:
            return

        internships = [
            dict(title="Youth Affairs Intern", organization="City Government of Lucena", location="Lucena City", mode="onsite", status="open", slots=5, requirements="Must be an active SK official or youth leader.", description="Join the City Youth Affairs office and gain hands-on experience in governance and youth program administration.", deadline=date.today() + timedelta(days=30), is_featured=True),
            dict(title="Digital Communications Intern", organization="Quezon ICT Council", location="Lucena City", mode="hybrid", status="open", slots=3, requirements="Basic computer skills and interest in communications.", description="Help develop digital content and social media campaigns for youth governance programs.", deadline=date.today() + timedelta(days=45), is_featured=False),
            dict(title="Community Development Intern", organization="DILG Quezon Province", location="Quezon Province", mode="onsite", status="open", slots=10, requirements="Interest in community development and social work.", description="Support barangay-level community development programs across Quezon Province.", deadline=date.today() + timedelta(days=60), is_featured=True),
        ]

        for data in internships:
            Internship.objects.get_or_create(title=data["title"], organization=data["organization"], defaults={**data, "posted_by": admin})

        self.stdout.write(self.style.SUCCESS("  [OK] Internships seeded"))

    # --- Events ---
    def _events(self):
        from apps.events.models import Event

        try:
            admin = User.objects.get(email="admin@lucena.gov.ph")
        except User.DoesNotExist:
            return

        now = timezone.now()
        events = [
            dict(title="SK Federation General Assembly 2024",
                 event_type="town_hall", location="Lucena City Hall, Plenary Hall",
                 start_datetime=now - timedelta(days=180), end_datetime=now - timedelta(days=180) + timedelta(hours=4),
                 capacity=300, is_published=True, is_featured=False,
                 description="Annual general assembly of all SK Federations across Lucena City's 33 barangays."),
            dict(title="Youth Health Forum 2024",
                 event_type="workshop", location="Lucena City Health Center, Auditorium",
                 start_datetime=now - timedelta(days=120), end_datetime=now - timedelta(days=120) + timedelta(hours=5),
                 capacity=100, is_published=True, is_featured=False,
                 description="Forum on adolescent health, mental health, and reproductive health education for youth."),
            dict(title="Linggo ng Kabataan Training Workshop 2024",
                 event_type="training", location="Barangay 1 Multi-Purpose Hall",
                 start_datetime=now - timedelta(days=100), end_datetime=now - timedelta(days=100) + timedelta(hours=6),
                 capacity=80, is_published=True, is_featured=False,
                 description="Capacity-building workshop for SK officials on planning and executing Linggo ng Kabataan activities."),
            dict(title="Environmental Youth Summit",
                 event_type="consultation", location="Lucena City Environmental Office",
                 start_datetime=now - timedelta(days=75), end_datetime=now - timedelta(days=75) + timedelta(hours=3),
                 capacity=60, is_published=True, is_featured=False,
                 description="Consultation forum for youth-led environmental initiatives across Quezon Province."),
            dict(title="SK Budget and Finance Training 2024",
                 event_type="training", location="City Accounting Office Training Room",
                 start_datetime=now - timedelta(days=50), end_datetime=now - timedelta(days=50) + timedelta(hours=8),
                 capacity=70, is_published=True, is_featured=False,
                 description="Mandatory training on SK fund management, disbursement procedures, and liquidation report preparation."),
            dict(title="Lucena City Youth Summit 2024",
                 event_type="town_hall", location="Lucena Grand Central Terminal Events Hall",
                 start_datetime=now - timedelta(days=30), end_datetime=now - timedelta(days=29),
                 capacity=500, is_published=True, is_featured=True,
                 description="Annual city-wide youth summit gathering 500+ youth leaders to discuss priority programs and barangay concerns."),
            dict(title="SK Year-End Celebration and Awards Night",
                 event_type="other", location="Lucena City Plaza",
                 start_datetime=now - timedelta(days=14), end_datetime=now - timedelta(days=14) + timedelta(hours=4),
                 capacity=400, is_published=True, is_featured=False,
                 description="Year-end celebration recognising outstanding SK officials, youth leaders, and partner organizations."),
            dict(title="Digital Governance Workshop for SK",
                 event_type="workshop", location="STI College Lucena Computer Lab",
                 start_datetime=now - timedelta(days=7), end_datetime=now - timedelta(days=7) + timedelta(hours=5),
                 capacity=40, is_published=True, is_featured=False,
                 description="Hands-on workshop on using digital tools for SK documentation, reporting, and constituent engagement."),
            dict(title="SK Leadership Summit 2025",
                 event_type="webinar", location="Online",
                 meeting_link="https://meet.google.com/lucena-sk-summit",
                 start_datetime=now + timedelta(days=7), end_datetime=now + timedelta(days=7, hours=3),
                 capacity=200, is_published=True, is_featured=True,
                 description="Annual summit bringing together SK officials from across Quezon Province to share best practices and leadership strategies."),
            dict(title="Youth Town Hall: Governance Forum",
                 event_type="town_hall", location="Lucena City Hall, Session Hall",
                 start_datetime=now + timedelta(days=14), end_datetime=now + timedelta(days=14, hours=4),
                 capacity=150, is_published=True, is_featured=False,
                 description="Open forum for youth leaders to engage directly with local officials on pressing youth concerns."),
            dict(title="Financial Literacy Workshop for SK",
                 event_type="workshop", location="Lucena City Library",
                 start_datetime=now + timedelta(days=21), end_datetime=now + timedelta(days=21, hours=6),
                 capacity=50, is_published=True, is_featured=False,
                 description="Hands-on workshop covering SK fund management, budget preparation, and financial reporting requirements."),
            dict(title="Digital Skills for Youth Leaders",
                 event_type="training", location="Lucena City College, IT Building",
                 start_datetime=now + timedelta(days=35), end_datetime=now + timedelta(days=35, hours=6),
                 capacity=60, is_published=True, is_featured=False,
                 description="Practical training on using technology for governance, communication, and community engagement."),
            dict(title="Youth Mental Health Symposium",
                 event_type="workshop", location="Notre Dame College of Quezon, Auditorium",
                 start_datetime=now + timedelta(days=42), end_datetime=now + timedelta(days=42, hours=4),
                 capacity=120, is_published=True, is_featured=False,
                 description="Symposium on youth mental health awareness, stress management, and support resources for SK officials and youth leaders."),
            dict(title="SK Federation Consultation 2025",
                 event_type="consultation", location="Lucena City Hall, Conference Room",
                 start_datetime=now + timedelta(days=56), end_datetime=now + timedelta(days=56, hours=3),
                 capacity=80, is_published=True, is_featured=False,
                 description="Mid-year consultation with SK Federation officers on Q3 program implementation and compliance monitoring."),
            dict(title="Linggo ng Kabataan 2025 Planning Workshop",
                 event_type="workshop", location="LYDO Conference Room",
                 start_datetime=now + timedelta(days=70), end_datetime=now + timedelta(days=70, hours=4),
                 capacity=50, is_published=False, is_featured=False,
                 description="[DRAFT] Planning workshop for barangay SK councils to coordinate 2025 Linggo ng Kabataan activities."),
        ]

        for data in events:
            Event.objects.get_or_create(title=data["title"], defaults={**data, "organizer": admin})

        self.stdout.write(self.style.SUCCESS("  [OK] Events seeded"))

    # --- Projects ---
    def _projects(self):
        from apps.projects.models import Project, ProjectMember, Task, Milestone

        try:
            youth1 = User.objects.get(email="youth1@gmail.com")
            youth2 = User.objects.get(email="youth2@gmail.com")
        except User.DoesNotExist:
            return

        projects = [
            dict(title="Barangay Clean and Green Drive", category="environment", status="active", description="Monthly clean-up drives across barangays to promote environmental awareness and cleanliness.", is_public=True, tags=["environment", "volunteer", "community"]),
            dict(title="Digital Literacy Program for Seniors", category="education", status="proposed", description="Teaching digital skills to senior citizens to help them connect with family and access government services online.", is_public=True, tags=["education", "technology", "seniors"]),
        ]

        for data in projects:
            slug = data["title"].lower().replace(" ", "-")[:50]
            project, created = Project.objects.get_or_create(slug=slug, defaults={**data, "created_by": youth1})
            if created:
                ProjectMember.objects.get_or_create(project=project, user=youth1, defaults=dict(role="leader"))
                ProjectMember.objects.get_or_create(project=project, user=youth2, defaults=dict(role="member"))
                Task.objects.get_or_create(project=project, title="Initial planning meeting", defaults=dict(status="done", priority="high", assigned_to=youth1))
                Task.objects.get_or_create(project=project, title="Recruit volunteers", defaults=dict(status="in_progress", priority="medium", assigned_to=youth2))
                Milestone.objects.get_or_create(project=project, title="Project kickoff", defaults=dict(due_date=date.today() + timedelta(days=7), completed=False))

        self.stdout.write(self.style.SUCCESS("  [OK] Projects seeded"))

    # --- Announcements ---
    def _announcements(self):
        from apps.recognition.models import Announcement

        try:
            admin = User.objects.get(email="admin@lucena.gov.ph")
        except User.DoesNotExist:
            return

        announcements = [
            dict(title="SK Annual Report Submission Deadline", content="All SK officials are reminded to submit their annual activity reports by end of this month. Contact the Youth Affairs Office for the required form.", is_published=True, published_at=timezone.now(), target_roles=["youth"]),
            dict(title="New Internship Opportunities Available", content="Check the Internship section for new opportunities posted by our LGU partners. These are exclusively available to active SK members.", is_published=True, published_at=timezone.now(), target_roles=["youth"]),
            dict(title="Platform Update: New Features Available", content="The Lucena Youth Leadership Hub has been updated with new features including the School Finder and improved dashboard. Explore the new modules today!", is_published=True, published_at=timezone.now(), target_roles=["youth", "lgu_admin"]),
        ]

        for data in announcements:
            Announcement.objects.get_or_create(title=data["title"], defaults={**data, "created_by": admin})

        self.stdout.write(self.style.SUCCESS("  [OK] Announcements seeded"))

    # --- FAQs ---
    def _faqs(self):
        from apps.support.models import FAQ

        faqs = [
            dict(question="Who can register on the Lucena Youth Leadership Hub?", answer="Any youth leader, SK official, or LGU staff from Lucena City and surrounding municipalities can register. Choose your appropriate role during registration.", category="General", order=1),
            dict(question="How do I apply for an internship?", answer="Go to the Internships section, browse available opportunities, click View Details on an internship, and click Apply Now. You will need to upload your resume and write a cover letter.", category="Internships", order=2),
            dict(question="How are compliance scores calculated?", answer="Compliance scores are calculated based on your activity: course completions, event attendance, project contributions, volunteer activities, and internship participation each earn points tracked by your LGU admin.", category="Compliance", order=3),
            dict(question="Can I save schools to compare them?", answer="Yes! In the Find Schools section, click the bookmark icon to save a school or the compare icon to add it to your comparison list. You can compare up to 4 schools side by side.", category="Schools", order=4),
        ]

        for data in faqs:
            FAQ.objects.get_or_create(question=data["question"], defaults={**data, "is_published": True})

        self.stdout.write(self.style.SUCCESS("  [OK] FAQs seeded"))

    # --- Compliance Records ---
    def _compliance_records(self):
        from apps.compliance.models import ComplianceRecord

        try:
            admin = User.objects.get(email="admin@lucena.gov.ph")
            youth_users = list(User.objects.filter(role="youth"))
        except User.DoesNotExist:
            return

        record_types = [
            ("event_attendance", "Attended SK Leadership Summit", 10),
            ("course_completion", "Completed Leadership Fundamentals", 20),
            ("volunteer_activity", "Participated in Clean-up Drive", 5),
            ("governance_participation", "Attended Barangay Council Meeting", 10),
        ]

        for user in youth_users:
            for rtype, desc, val in record_types:
                ComplianceRecord.objects.get_or_create(
                    user=user, record_type=rtype, description=desc,
                    defaults=dict(value=val, recorded_by=admin)
                )

        self.stdout.write(self.style.SUCCESS("  [OK] Compliance records seeded"))

    # --- Youth Organizations ---
    def _youth_orgs(self):
        from apps.youth_orgs.models import YouthOrganization, OrgAccomplishment
        self.stdout.write("  Seeding youth organizations...")

        orgs = [
            dict(name="Barangay 1 SK Council", classification="school_based",
                 sub_classification="sk_council", registration_category="lydo",
                 barangay="Barangay 1", description="SK Council of Barangay 1 Lucena City.",
                 contact_person="Juan Dela Cruz", is_compliant=True),
            dict(name="Barangay 3 SK Council", classification="community_based",
                 sub_classification="sk_council", registration_category="lydo",
                 barangay="Barangay 3", description="SK Council of Barangay 3 Lucena City.",
                 contact_person="Maria Garcia", is_compliant=True),
            dict(name="Barangay 9 SK Council", classification="community_based",
                 sub_classification="sk_council", registration_category="lydo",
                 barangay="Barangay 9", description="SK Council of Barangay 9 serving youth in the Dalahican corridor.",
                 contact_person="Ramon Aquino", is_compliant=False),
            dict(name="Lucena Youth Advocates", classification="community_based",
                 sub_classification="youth_org", registration_category="nyc",
                 barangay="Barangay 5", description="Non-profit youth organization promoting civic engagement and community service.",
                 contact_person="Pedro Bautista", is_compliant=True),
            dict(name="Green Youth Lucena", classification="community_based",
                 sub_classification="youth_org", registration_category="nyc",
                 barangay="Barangay 5", description="Community-based youth organization promoting environmental advocacy and civic engagement.",
                 contact_person="Pedro Santos", is_compliant=False),
            dict(name="St. Ferdinand Youth Ministry", classification="faith_based",
                 sub_classification="youth_org", registration_category="lydo",
                 barangay="Barangay 7", description="Faith-based youth organization under St. Ferdinand Parish.",
                 contact_person="Ana Reyes", is_compliant=True),
            dict(name="Lucena City College Student Council", classification="school_based",
                 sub_classification="youth_serving", registration_category="nyc",
                 barangay="Barangay 2", description="Student council representing LCC students and promoting student welfare.",
                 contact_person="Carlo Bautista", is_compliant=False),
            dict(name="Green Youth Quezon", classification="community_based",
                 sub_classification="youth_serving", registration_category="not_registered",
                 barangay="Barangay 10", description="Environmental youth advocacy group for Quezon province.",
                 contact_person="Rosa Mendoza", is_compliant=False),
            dict(name="Mayao Youth Sports Federation", classification="community_based",
                 sub_classification="youth_org", registration_category="lydo",
                 barangay="Mayao Kanluran", description="Youth sports federation organising inter-barangay sports leagues and fitness programs.",
                 contact_person="Jasmine Aquino", is_compliant=True),
            dict(name="St. John Youth Fellowship", classification="faith_based",
                 sub_classification="youth_org", registration_category="nyc",
                 barangay="Gulang-Gulang", description="Youth ministry of St. John the Baptist Parish serving the Gulang-Gulang community.",
                 contact_person="Zenaida Rosales", is_compliant=False),
            dict(name="Quezon State University Student Government", classification="school_based",
                 sub_classification="youth_serving", registration_category="nyc",
                 barangay="Dalahican", description="Student government representing QSU Lucena Campus students.",
                 contact_person="Sofia Cruz", is_compliant=True),
            dict(name="Bocohan Youth for Sustainability", classification="community_based",
                 sub_classification="youth_org", registration_category="not_registered",
                 barangay="Bocohan", description="Youth-led sustainability group focused on waste management and urban farming.",
                 contact_person="Edilberto Macalintal", is_compliant=False),
        ]
        self._orgs = {}
        for d in orgs:
            org, _ = YouthOrganization.objects.get_or_create(name=d["name"], defaults=d)
            self._orgs[d["name"]] = org

        accomplishments = [
            ("Barangay 1 SK Council", "Linggo ng Kabataan 2024",
             "Successfully organised week-long youth activities with 200+ participants.", -60),
            ("Lucena Youth Advocates", "Community Clean-Up Drive",
             "Led 5 clean-up drives across 3 barangays, engaging 150 youth volunteers.", -30),
            ("Mayao Youth Sports Federation", "Inter-Barangay Sports Fest 2024",
             "Hosted 8-sport tournament with 350 youth participants across 12 barangays.", -45),
            ("St. Ferdinand Youth Ministry", "Youth Spiritual Retreat 2024",
             "Organised 3-day retreat for 80 youth members focused on values formation.", -90),
            ("Quezon State University Student Government", "Campus Clean and Green Drive",
             "Planted 200 trees within the campus and partnered with DENR for seedling distribution.", -20),
        ]
        for org_name, title, desc, days in accomplishments:
            if org_name in self._orgs:
                OrgAccomplishment.objects.get_or_create(
                    organization=self._orgs[org_name],
                    title=title,
                    defaults=dict(description=desc, date_achieved=date.today() + timedelta(days=days))
                )
        self.stdout.write(self.style.SUCCESS("  [OK] Youth organizations seeded"))

    # --- SK Barangays ---
    def _sk_barangays(self):
        from apps.sk_requirements.models import SKBarangay, SKRequirement
        self.stdout.write("  Seeding SK barangays & requirements...")

        barangays = [
            ("Barangay 1",      "Juan Dela Cruz",        "sk.brgy1@lucena.gov.ph",            "09171234501", 10),
            ("Barangay 2",      "Maria Santos",          "sk.brgy2@lucena.gov.ph",            "09171234502", 10),
            ("Barangay 3",      "Pedro Garcia",          "sk.brgy3@lucena.gov.ph",            "09171234503", 10),
            ("Barangay 4",      "Ana Reyes",             "sk.brgy4@lucena.gov.ph",            "09171234504",  9),
            ("Barangay 5",      "Carlos Bautista",       "sk.brgy5@lucena.gov.ph",            "09171234505",  8),
            ("Barangay 6",      "Rosa Cruz",             "sk.brgy6@lucena.gov.ph",            "09171234506",  8),
            ("Barangay 7",      "Jose Mendoza",          "sk.brgy7@lucena.gov.ph",            "09171234507",  7),
            ("Barangay 8",      "Elena Torres",          "sk.brgy8@lucena.gov.ph",            "09171234508",  7),
            ("Barangay 9",      "Ramon Aquino",          "sk.brgy9@lucena.gov.ph",            "09171234509",  6),
            ("Barangay 10",     "Carmen Villanueva",     "sk.brgy10@lucena.gov.ph",           "09171234510",  5),
            ("Barangay 11",     "Roberto Flores",        "sk.brgy11@lucena.gov.ph",           "09171234511",  5),
            ("Barra",           "Ligaya Santillan",      "sk.barra@lucena.gov.ph",            "09171234512",  7),
            ("Bocohan",         "Edilberto Macalintal",  "sk.bocohan@lucena.gov.ph",          "09171234513",  9),
            ("Cotta",           "Natividad Paglinawan",  "sk.cotta@lucena.gov.ph",            "09171234514",  6),
            ("Dalahican",       "Renato Ilustrisimo",    "sk.dalahican@lucena.gov.ph",        "09171234515",  8),
            ("Domoit",          "Felicitas Gervacio",    "sk.domoit@lucena.gov.ph",           "09171234516",  4),
            ("Gulang-Gulang",   "Zenaida Rosales",       "sk.gulang@lucena.gov.ph",           "09171234517", 10),
            ("Ibabang Dupay",   "Romualdo Catindig",     "sk.ibabdupay@lucena.gov.ph",        "09171234518",  2),
            ("Ibabang Iyam",    "Teresita Alcantara",    "sk.ibabiyam@lucena.gov.ph",         "09171234519",  7),
            ("Ibabang Talim",   "Arnel Dalisay",         "sk.ibabtalim@lucena.gov.ph",        "09171234520",  4),
            ("Ilayang Dupay",   "Nestor Malabanan",      "sk.ilaydupay@lucena.gov.ph",        "09171234521",  5),
            ("Ilayang Iyam",    "Concepcion Tolentino",  "sk.ilayiyam@lucena.gov.ph",         "09171234522",  3),
            ("Ilayang Talim",   "Maricel Sarmiento",     "sk.ilaytalim@lucena.gov.ph",        "09171234523",  3),
            ("Isabang",         "Benjamin Mendez",       "sk.isabang@lucena.gov.ph",          "09171234524",  8),
            ("Market View",     "Angelita Borja",        "sk.marketview@lucena.gov.ph",       "09171234525",  6),
            ("Mayao Castillo",  "Rodrigo Estrada",       "sk.mayaocastillo@lucena.gov.ph",    "09171234526",  2),
            ("Mayao Crossing",  "Dionisio Buenaventura", "sk.mayaocross@lucena.gov.ph",       "09171234527",  2),
            ("Mayao Kanluran",  "Lourdes Samson",        "sk.mayaok@lucena.gov.ph",           "09171234528",  9),
            ("Mayao Parada",    "Simplicio Arguelles",   "sk.mayaop@lucena.gov.ph",           "09171234529",  1),
            ("Mayao Silangan",  "Virgilio Almazan",      "sk.mayaos@lucena.gov.ph",           "09171234530",  0),
            ("Ransohan",        "Milagros Abriol",       "sk.ransohan@lucena.gov.ph",         "09171234531",  3),
            ("Salinas",         "Lorena Gatchalian",     "sk.salinas@lucena.gov.ph",          "09171234532",  6),
            ("Talao-Talao",     "Ferdinand Navarro",     "sk.talaotalao@lucena.gov.ph",       "09171234533",  4),
        ]

        req_types = [
            "cbydp", "abyip", "annual_budget", "quarterly_cash",
            "monthly_pr", "annex_h", "policies", "minutes",
            "kk_assembly", "linggo_kabataan",
        ]

        for bname, chair, email, phone, submitted_count in barangays:
            brgy, _ = SKBarangay.objects.get_or_create(
                barangay_name=bname,
                defaults=dict(sk_chairperson=chair, contact_email=email, contact_phone=phone)
            )
            for i, rtype in enumerate(req_types):
                is_submitted = i < submitted_count
                is_overdue = not is_submitted and submitted_count <= 4 and i < 6
                status = "submitted" if is_submitted else ("overdue" if is_overdue else "pending")
                SKRequirement.objects.get_or_create(
                    barangay=brgy, requirement_type=rtype,
                    defaults=dict(
                        status=status,
                        submitted_at=timezone.now() - timedelta(days=30 + i * 5) if is_submitted else None,
                        due_date=date.today() - timedelta(days=10) if is_overdue else date.today() + timedelta(days=30),
                    )
                )
        self.stdout.write(self.style.SUCCESS("  [OK] SK barangays seeded (33 barangays)"))

    # --- Jobs ---
    def _jobs(self):
        from apps.jobs.models import JobOpportunity
        self.stdout.write("  Seeding job opportunities...")

        admin = User.objects.filter(role="lgu_admin").first()
        jobs = [
            dict(title="Administrative Aide - City Youth Office", company_or_org="City Government of Lucena",
                 location="Lucena City Hall", job_type="full_time", industry="government",
                 description="Assist the City Youth Development Office in administrative tasks, event coordination, and youth program implementation.",
                 requirements="College graduate preferred. Fresh graduates welcome. Must be a resident of Lucena City.",
                 salary_range="PHP 15,000 - 18,000/month", is_active=True, is_featured=True,
                 application_deadline=date.today() + timedelta(days=20), posted_by=admin),
            dict(title="Youth Program Coordinator", company_or_org="Quezon Province LYDO",
                 location="Quezon Capitol, Lucena City", job_type="contract", industry="government",
                 description="Coordinate and monitor youth programs across Quezon Province. Requires coordination with SK officials and youth organizations.",
                 requirements="Bachelor's degree in Social Work, Public Administration, or related field. 1-2 years experience preferred.",
                 salary_range="PHP 20,000 - 25,000/month", is_active=True, is_featured=True,
                 application_deadline=date.today() + timedelta(days=15), posted_by=admin),
            dict(title="Junior Web Developer", company_or_org="Lucena City Tech Hub",
                 location="Lucena City", job_type="full_time", industry="tech",
                 description="Develop and maintain web applications for local government digitization projects.",
                 requirements="Graduate of IT, Computer Science, or related course. Knowledge of HTML, CSS, JavaScript. PHP or Python experience is a plus.",
                 salary_range="PHP 18,000 - 22,000/month", is_active=True, is_featured=False,
                 application_deadline=date.today() + timedelta(days=30), posted_by=admin),
            dict(title="Teaching Assistant - DepEd Quezon", company_or_org="DepEd Division of Quezon",
                 location="Various Schools, Lucena City", job_type="part_time", industry="education",
                 description="Assist classroom teachers in daily instruction, student monitoring, and preparation of learning materials.",
                 requirements="Education graduate or currently enrolled in Education course. Must have valid teaching internship clearance.",
                 salary_range="PHP 600/day", is_active=True, is_featured=False,
                 application_deadline=date.today() + timedelta(days=10), posted_by=admin),
            dict(title="Community Health Worker", company_or_org="Lucena City Health Office",
                 location="Various Barangays, Lucena City", job_type="volunteer", industry="health",
                 description="Conduct community health education, assist in immunization campaigns, and support barangay health workers.",
                 requirements="Health-related course preferred. Willing to do fieldwork in various barangays.",
                 salary_range="Stipend provided", is_active=True, is_featured=False,
                 application_deadline=date.today() + timedelta(days=25), posted_by=admin),
        ]
        for d in jobs:
            JobOpportunity.objects.get_or_create(title=d["title"], company_or_org=d["company_or_org"], defaults=d)
        self.stdout.write(self.style.SUCCESS("  [OK] Jobs seeded"))

    # --- Youth Programs ---
    def _youth_programs(self):
        from apps.programs.models import YouthProgram
        self.stdout.write("  Seeding youth programs...")

        admin = User.objects.filter(role="lgu_admin").first()
        youth1 = User.objects.filter(email="youth1@gmail.com").first()
        youth2 = User.objects.filter(email="youth2@gmail.com").first()
        youth3 = User.objects.filter(email="youth3@gmail.com").first()
        youth5 = User.objects.filter(email="youth5@gmail.com").first()
        youth6 = User.objects.filter(email="youth6@gmail.com").first()

        programs = [
            dict(title="Linggo ng Kabataan 2024 - Barangay 1", category="active_citizenship",
                 status="completed", submitter_type="sk", barangay="Barangay 1",
                 description="Week-long celebration of youth through sports, arts, and civic activities.",
                 objectives="Promote youth participation in community activities.",
                 male_participants=85, female_participants=120,
                 start_date=date.today() - timedelta(days=150),
                 end_date=date.today() - timedelta(days=143),
                 location="Barangay 1 Multi-Purpose Hall", is_featured=True, submitted_by=admin),
            dict(title="Environmental Clean-Up Drive - Q4 2024", category="environment",
                 status="completed", submitter_type="sk", barangay="Barangay 3",
                 description="Monthly clean-up operations targeting public spaces, esteros, and roads.",
                 objectives="Reduce waste and promote environmental awareness among youth.",
                 male_participants=45, female_participants=55,
                 start_date=date.today() - timedelta(days=120),
                 end_date=date.today() - timedelta(days=120),
                 location="Barangay 3 Public Areas", is_featured=True, submitted_by=admin),
            dict(title="Digital Literacy Workshop for Senior Citizens", category="education",
                 status="completed", submitter_type="youth_org", barangay="Barangay 5",
                 description="Free digital skills training for senior citizens teaching them how to use smartphones and access government services online.",
                 objectives="Bridge the digital divide between youth and senior citizens.",
                 male_participants=20, female_participants=35,
                 start_date=date.today() - timedelta(days=100),
                 end_date=date.today() - timedelta(days=98),
                 location="Barangay 5 Senior Citizens Center", is_featured=True, submitted_by=youth1),
            dict(title="SK Governance Training 2024", category="governance",
                 status="completed", submitter_type="sk", barangay="Barangay 4",
                 description="Capacity-building training on parliamentary procedure, SK governance, and DILG compliance for newly elected SK officers.",
                 objectives="Equip SK officials with governance knowledge and skills.",
                 male_participants=30, female_participants=25,
                 start_date=date.today() - timedelta(days=90),
                 end_date=date.today() - timedelta(days=89),
                 location="Barangay 4 Barangay Hall", is_featured=False, submitted_by=admin),
            dict(title="Youth Mental Health Awareness Week", category="health",
                 status="completed", submitter_type="sk", barangay="Barangay 8",
                 description="Week-long mental health campaign including free counselling sessions, stress management workshops, and peer-support training.",
                 objectives="Reduce stigma around mental health and connect youth with professional resources.",
                 male_participants=40, female_participants=65,
                 start_date=date.today() - timedelta(days=80),
                 end_date=date.today() - timedelta(days=74),
                 location="Barangay 8 Health Center and Community Hall", is_featured=False, submitted_by=youth5),
            dict(title="Peace and Conflict Resolution Forum", category="peace_building",
                 status="completed", submitter_type="youth_org", barangay="Barangay 6",
                 description="Youth dialogue forum addressing community conflict, peacebuilding strategies, and the role of young people in sustaining peace.",
                 objectives="Build understanding and dialogue skills among youth from diverse backgrounds.",
                 male_participants=35, female_participants=40,
                 start_date=date.today() - timedelta(days=70),
                 end_date=date.today() - timedelta(days=70),
                 location="Barangay 6 Community Hall", is_featured=False, submitted_by=youth3),
            dict(title="Urban Agriculture Youth Training", category="agriculture",
                 status="completed", submitter_type="sk", barangay="Bocohan",
                 description="Hands-on training on container gardening, composting, and urban farming techniques for youth in densely-populated barangays.",
                 objectives="Promote food security and productive use of urban spaces among youth.",
                 male_participants=25, female_participants=30,
                 start_date=date.today() - timedelta(days=60),
                 end_date=date.today() - timedelta(days=58),
                 location="Bocohan Barangay Hall and Vacant Lot", is_featured=False, submitted_by=youth6),
            dict(title="Social Inclusion Campaign for PWDs", category="social_inclusion",
                 status="completed", submitter_type="youth_org", barangay="Barangay 9",
                 description="Awareness campaign promoting inclusion of youth with disabilities in community programs, sports, and governance activities.",
                 objectives="Foster an inclusive community where all youth can participate regardless of ability.",
                 male_participants=22, female_participants=28,
                 start_date=date.today() - timedelta(days=50),
                 end_date=date.today() - timedelta(days=49),
                 location="Barangay 9 Multi-Purpose Hall", is_featured=False, submitted_by=admin),
            dict(title="Youth Leadership Summit 2024", category="governance",
                 status="completed", submitter_type="youth_org", barangay="Barangay 2",
                 description="City-wide leadership summit for youth org officers covering governance, project management, and youth rights.",
                 objectives="Develop leadership capacity of youth organization leaders across Lucena City.",
                 male_participants=60, female_participants=80,
                 start_date=date.today() - timedelta(days=40),
                 end_date=date.today() - timedelta(days=39),
                 location="Lucena City Hall Events Hall", is_featured=True, submitted_by=admin),
            dict(title="Global Mobility Seminar for Youth", category="global_mobility",
                 status="completed", submitter_type="youth_org", barangay="Dalahican",
                 description="Seminar on international scholarships, overseas employment preparation, and global citizenship for youth.",
                 objectives="Equip youth with knowledge on global opportunities and responsible global citizenship.",
                 male_participants=30, female_participants=45,
                 start_date=date.today() - timedelta(days=25),
                 end_date=date.today() - timedelta(days=25),
                 location="Lucena City College Auditorium", is_featured=False, submitted_by=youth3),
            dict(title="Youth Health Awareness Campaign 2025", category="health",
                 status="ongoing", submitter_type="sk", barangay="Barangay 7",
                 description="Monthly health education sessions covering mental health, nutrition, and reproductive health for youth.",
                 objectives="Improve health literacy among Lucena City youth.",
                 male_participants=30, female_participants=50,
                 start_date=date.today() - timedelta(days=30),
                 end_date=date.today() + timedelta(days=60),
                 location="Barangay 7 Health Center", is_featured=False, submitted_by=admin),
            dict(title="Livelihood Training - Basic Sewing and Tailoring", category="economic",
                 status="ongoing", submitter_type="youth_org", barangay="Barangay 2",
                 description="TESDA-accredited sewing and tailoring course for out-of-school youth and unemployed youth.",
                 objectives="Provide vocational skills to improve youth employability.",
                 male_participants=10, female_participants=40,
                 start_date=date.today() - timedelta(days=14),
                 end_date=date.today() + timedelta(days=46),
                 location="Barangay 2 Livelihood Center", is_featured=False, submitted_by=youth2),
            dict(title="Economic Empowerment Through Microenterprise", category="economic",
                 status="ongoing", submitter_type="sk", barangay="Gulang-Gulang",
                 description="Microenterprise development program training youth on basic business planning, product development, and market linkage.",
                 objectives="Reduce youth unemployment through microenterprise skills development.",
                 male_participants=18, female_participants=32,
                 start_date=date.today() - timedelta(days=20),
                 end_date=date.today() + timedelta(days=40),
                 location="Gulang-Gulang Livelihood Center", is_featured=False, submitted_by=youth6),
            dict(title="Kalinisan at Kalikasan Festival 2025", category="environment",
                 status="upcoming", submitter_type="sk", barangay="Barangay 10",
                 description="Community festival combining environmental awareness, tree planting, and waste segregation education.",
                 objectives="Foster environmental stewardship among youth and the community.",
                 male_participants=0, female_participants=0,
                 start_date=date.today() + timedelta(days=15),
                 end_date=date.today() + timedelta(days=16),
                 location="Barangay 10 Plaza", is_featured=False, submitted_by=admin),
            dict(title="Community Health Drive - Mayao Cluster", category="health",
                 status="upcoming", submitter_type="sk", barangay="Mayao Kanluran",
                 description="Free medical check-up, dental services, and health education for youth and their families in the Mayao area.",
                 objectives="Expand health access for youth in the Mayao barangays.",
                 male_participants=0, female_participants=0,
                 start_date=date.today() + timedelta(days=30),
                 end_date=date.today() + timedelta(days=30),
                 location="Mayao Kanluran Elementary School Grounds", is_featured=False, submitted_by=youth5),
            dict(title="Youth Entrepreneurship Fair 2024", category="economic",
                 status="cancelled", submitter_type="youth_org", barangay="Barangay 5",
                 description="Planned showcase of youth-led businesses and microenterprises. Cancelled due to inclement weather.",
                 objectives="Provide youth entrepreneurs with a platform to showcase products and attract buyers.",
                 male_participants=0, female_participants=0,
                 start_date=date.today() - timedelta(days=45),
                 end_date=date.today() - timedelta(days=45),
                 location="Lucena City Plaza", is_featured=False, submitted_by=admin),
        ]
        for d in programs:
            YouthProgram.objects.get_or_create(title=d["title"], barangay=d["barangay"], defaults=d)
        self.stdout.write(self.style.SUCCESS("  [OK] Youth programs seeded"))

    # --- Featured Posts ---
    def _featured_posts(self):
        from apps.events.models import FeaturedPost

        admin = User.objects.filter(role="lgu_admin").first()
        self.stdout.write("  Seeding featured posts...")

        posts = [
            dict(
                post_type='national_event',
                title="Linggo ng Kabataan 2024",
                content="The annual Linggo ng Kabataan was celebrated nationwide...",
                source="NYC - National Youth Commission",
                date_of_event=date(2024, 11, 18),
                is_published=True,
                order=1,
            ),
            dict(
                post_type='local_event',
                title="Lucena City Youth Summit 2024",
                content="Over 500 youth leaders gathered at the Lucena City Hall for the annual Youth Summit...",
                source="Lucena City Youth Development Office",
                date_of_event=date(2024, 10, 5),
                is_published=True,
                order=2,
            ),
            dict(
                post_type='news',
                title="Republic Act 10742 - SK Reform Law",
                content="The Sangguniang Kabataan Reform Act strengthens the mandate of SK in local governance...",
                source="Office of the President",
                date_of_event=date(2023, 3, 15),
                is_published=True,
                order=3,
            ),
            dict(
                post_type='youth_info',
                title="NYC Youth Development Framework",
                content="The National Youth Commission released guidelines for youth development programs...",
                source="National Youth Commission",
                date_of_event=date(2024, 6, 1),
                is_published=True,
                order=4,
            ),
            dict(
                post_type='update',
                title="LYDO Program Updates for 2025",
                content="The Lucena City Youth Development Office announces new programs for registered youth...",
                source="LYDO Lucena City",
                date_of_event=date(2025, 1, 10),
                is_published=True,
                order=5,
            ),
        ]

        for d in posts:
            FeaturedPost.objects.get_or_create(title=d["title"], defaults={**d, "created_by": admin})

        self.stdout.write(self.style.SUCCESS("  [OK] Featured posts seeded"))

    # --- Enrollments ---
    def _enrollments(self):
        from apps.courses.models import Course, Enrollment, Lesson, LessonProgress

        youth_emails = ["youth1@gmail.com", "youth2@gmail.com", "youth3@gmail.com", "youth4@gmail.com"]
        course_slugs_with_progress = [
            ("leadership-fundamentals",        100),
            ("youth-governance-101",            65),
            ("communication-skills-for-leaders", 25),
            ("financial-literacy-for-sk",        0),
        ]

        for email in youth_emails:
            try:
                user = User.objects.get(email=email)
            except User.DoesNotExist:
                continue

            for slug, progress_pct in course_slugs_with_progress:
                try:
                    course = Course.objects.get(slug=slug)
                except Course.DoesNotExist:
                    continue

                if progress_pct == 100:
                    status = "completed"
                elif progress_pct > 0:
                    status = "in_progress"
                else:
                    status = "enrolled"

                enrollment, created = Enrollment.objects.get_or_create(
                    user=user,
                    course=course,
                    defaults=dict(
                        progress_percent=progress_pct,
                        status=status,
                        completed_at=timezone.now() if status == "completed" else None,
                    ),
                )
                if not created:
                    continue

                lessons = list(Lesson.objects.filter(module__course=course).order_by("module__order", "order"))
                if not lessons:
                    continue
                done_count = int(len(lessons) * progress_pct / 100)
                for lesson in lessons[:done_count]:
                    LessonProgress.objects.get_or_create(
                        enrollment=enrollment,
                        lesson=lesson,
                        defaults=dict(completed=True, completed_at=timezone.now()),
                    )

        self.stdout.write(self.style.SUCCESS("  [OK] Enrollments seeded"))

    # --- UserBadges ---
    def _user_badges(self):
        from apps.recognition.models import Badge, UserBadge

        awards = {
            "youth1@gmail.com": ["Course Completer", "Learning Streak", "Governance Star", "SK Champion", "First Steps"],
            "youth2@gmail.com": ["Course Completer", "Governance Star", "First Steps"],
            "youth3@gmail.com": ["First Steps", "Internship Ready"],
            "youth4@gmail.com": ["First Steps"],
        }

        try:
            admin = User.objects.get(email="admin@lucena.gov.ph")
        except User.DoesNotExist:
            admin = None

        for email, badge_names in awards.items():
            try:
                user = User.objects.get(email=email)
            except User.DoesNotExist:
                continue
            for name in badge_names:
                try:
                    badge = Badge.objects.get(name=name)
                except Badge.DoesNotExist:
                    continue
                UserBadge.objects.get_or_create(
                    user=user, badge=badge,
                    defaults=dict(awarded_by=admin),
                )

        self.stdout.write(self.style.SUCCESS("  [OK] User badges seeded"))

    # --- Recognition Certificates ---
    def _recognition_certificates(self):
        from apps.recognition.models import Certificate
        from apps.courses.models import Enrollment

        completed = Enrollment.objects.filter(status="completed").select_related("user", "course")
        for i, en in enumerate(completed):
            cert_no = f"LYDO-CERT-{en.user.id:04d}-{en.course.id:03d}"
            Certificate.objects.get_or_create(
                certificate_number=cert_no,
                defaults=dict(
                    user=en.user,
                    title=f"{en.course.title} - Course Completion",
                    issued_by="LYDO Lucena City",
                    issued_at=date.today() - timedelta(days=14),
                    enrollment=en,
                ),
            )

        for email in ["youth1@gmail.com", "youth2@gmail.com"]:
            try:
                user = User.objects.get(email=email)
            except User.DoesNotExist:
                continue
            cert_no = f"LYDO-SERVICE-{user.id:04d}-2024"
            Certificate.objects.get_or_create(
                certificate_number=cert_no,
                defaults=dict(
                    user=user,
                    title="Outstanding Youth Leader 2024",
                    issued_by="City Government of Lucena",
                    issued_at=date(2024, 12, 15),
                ),
            )

        self.stdout.write(self.style.SUCCESS("  [OK] Recognition certificates seeded"))

    # --- Event Registrations ---
    def _event_registrations(self):
        from apps.events.models import Event, EventRegistration

        events = list(Event.objects.all())
        for email in ["youth1@gmail.com", "youth2@gmail.com", "youth3@gmail.com"]:
            try:
                user = User.objects.get(email=email)
            except User.DoesNotExist:
                continue
            for ev in events[:2]:
                EventRegistration.objects.get_or_create(event=ev, user=user)

        self.stdout.write(self.style.SUCCESS("  [OK] Event registrations seeded"))

    # --- Leaderboard ---
    def _leaderboard(self):
        from apps.recognition.models import LeaderboardEntry

        scores = {
            "youth1@gmail.com": dict(course_score=80, governance_score=120, project_score=60, volunteer_score=20, rank=1),
            "youth2@gmail.com": dict(course_score=60, governance_score=80,  project_score=40, volunteer_score=10, rank=2),
            "youth3@gmail.com": dict(course_score=40, governance_score=20,  project_score=20, volunteer_score=50, rank=3),
            "youth4@gmail.com": dict(course_score=10, governance_score=0,   project_score=0,  volunteer_score=0,  rank=4),
        }
        for email, vals in scores.items():
            try:
                user = User.objects.get(email=email)
            except User.DoesNotExist:
                continue
            total = sum(v for k, v in vals.items() if k.endswith("_score"))
            LeaderboardEntry.objects.update_or_create(
                user=user,
                defaults={**vals, "total_score": total},
            )

        self.stdout.write(self.style.SUCCESS("  [OK] Leaderboard seeded"))

    # --- Resources ---
    def _resources(self):
        from apps.resources.models import Resource

        admin = User.objects.filter(role="lgu_admin").first()
        items = [
            dict(title="SK Annual Activity Report Template",
                 description="Standard template SK officials use for the year-end activity report submitted to LYDO.",
                 resource_type="document", category="governance",
                 external_url="https://www.dilg.gov.ph/PDF_File/issuances/templates/sk-annual-report.pdf",
                 is_published=True, is_featured=True),
            dict(title="CBYDP Outline Template",
                 description="Comprehensive Barangay Youth Development Plan - official outline for SK officials.",
                 resource_type="document", category="governance",
                 external_url="https://www.dilg.gov.ph/issuances",
                 is_published=True, is_featured=True),
            dict(title="ABYIP Worksheet",
                 description="Annual Barangay Youth Investment Plan worksheet - fill-in-the-blank version for first-time SK officials.",
                 resource_type="form", category="governance",
                 is_published=True),
            dict(title="Republic Act 10742 - SK Reform Act of 2015",
                 description="The full text of the SK Reform Act, the law governing all Sangguniang Kabataan operations nationwide.",
                 resource_type="link", category="legal",
                 external_url="https://www.officialgazette.gov.ph/2016/01/15/republic-act-no-10742/",
                 is_published=True, is_featured=True),
            dict(title="Republic Act 8044 - Youth in Nation-Building Act",
                 description="The foundational law that created the National Youth Commission and recognized youth participation in governance.",
                 resource_type="link", category="legal",
                 external_url="https://www.officialgazette.gov.ph/1995/06/07/republic-act-no-8044/",
                 is_published=True),
            dict(title="DILG MC 2019-67 - Strengthening SK Operations",
                 description="DILG Memorandum Circular providing implementing guidelines for the SK Reform Act.",
                 resource_type="link", category="legal",
                 external_url="https://www.dilg.gov.ph/issuances/mc/Strengthening-SK-Operations/3175",
                 is_published=True),
            dict(title="Lucena City Youth Development Plan 2023-2027",
                 description="The four-year strategic plan of LYDO covering health, education, livelihood, and civic engagement for Lucena youth.",
                 resource_type="document", category="leadership",
                 is_published=True, is_featured=True),
            dict(title="Philippine Youth Development Plan (PYDP) 2023-2028",
                 description="The national framework for youth development by the National Youth Commission.",
                 resource_type="link", category="leadership",
                 external_url="https://nyc.gov.ph/pydp",
                 is_published=True),
            dict(title="SK Federation of Lucena - 2025 Workplan",
                 description="Citywide SK Federation calendar of activities for 2025 - capacity building, summits, and leadership programs.",
                 resource_type="document", category="governance",
                 is_published=True),
            dict(title="Adolescent Health Fact Sheet",
                 description="Quick-reference health information for youth, from the City Health Office.",
                 resource_type="document", category="health",
                 is_published=True),
            dict(title="Scholarship Application Checklist",
                 description="Documents and steps required for City and partner scholarship applications.",
                 resource_type="document", category="education",
                 is_published=True, is_featured=True),
            dict(title="Financial Management Guide for SK Treasurers",
                 description="Plain-language walkthrough of SK fund handling, vouchers, and liquidation reports.",
                 resource_type="document", category="financial",
                 is_published=True),
        ]

        for data in items:
            Resource.objects.get_or_create(
                title=data["title"],
                defaults={**data, "uploaded_by": admin},
            )

        self.stdout.write(self.style.SUCCESS("  [OK] Resources seeded"))

    # --- Surveys, Polls, Feedback ---
    def _surveys_polls_feedback(self):
        from apps.events.models import (
            Survey, SurveyQuestion, SurveyResponse,
            Poll, PollOption, PollResponse, Feedback,
            Event,
        )

        admin = User.objects.filter(role="lgu_admin").first()
        if not admin:
            return

        survey_data = [
            dict(
                title="2025 Lucena Youth Priorities Survey",
                description="Help LYDO shape next year's programs. Takes ~3 minutes.",
                questions=[
                    ("What's the single biggest issue facing Lucena youth today?", "text"),
                    ("Which area should LYDO focus on most in 2025?", "multiple_choice"),
                    ("How would you rate LYDO's communication with youth this year?", "rating"),
                ],
            ),
            dict(
                title="Post-Event Feedback: SK Leadership Summit",
                description="For attendees of the SK Leadership Summit 2025.",
                questions=[
                    ("Overall, how would you rate the summit?", "rating"),
                    ("Which session was most valuable to you?", "text"),
                    ("Would you attend again next year?", "multiple_choice"),
                ],
            ),
        ]

        for data in survey_data:
            survey, created = Survey.objects.get_or_create(
                title=data["title"],
                defaults=dict(description=data["description"], created_by=admin),
            )
            if created:
                for i, (qtext, qtype) in enumerate(data["questions"], start=1):
                    SurveyQuestion.objects.create(
                        survey=survey, question=qtext, question_type=qtype, order=i,
                    )

        respondents = ["youth1@gmail.com", "youth2@gmail.com", "youth3@gmail.com"]
        first_survey = Survey.objects.filter(title__icontains="Priorities").first()
        if first_survey:
            for email in respondents:
                try:
                    user = User.objects.get(email=email)
                except User.DoesNotExist:
                    continue
                SurveyResponse.objects.get_or_create(
                    survey=first_survey, user=user,
                    defaults=dict(answers={
                        "1": "Lack of skills training and job opportunities for fresh graduates.",
                        "2": "Education & scholarships",
                        "3": 4,
                    }),
                )

        events = list(Event.objects.all())
        polls = [
            dict(
                question="Should LYDO host the next youth summit online or in-person?",
                event=events[0] if events else None,
                options=["In-person", "Online", "Hybrid (best of both)"],
            ),
            dict(
                question="Which day of the week works best for SK orientation sessions?",
                event=None,
                options=["Saturday morning", "Saturday afternoon", "Sunday afternoon"],
            ),
        ]

        for pdata in polls:
            poll, created = Poll.objects.get_or_create(
                question=pdata["question"],
                defaults=dict(event=pdata["event"], created_by=admin, is_active=True),
            )
            if created:
                for i, opt in enumerate(pdata["options"], start=1):
                    PollOption.objects.create(poll=poll, text=opt, order=i)

        first_poll = Poll.objects.filter(question__icontains="summit").first()
        if first_poll:
            options = list(first_poll.options.all())
            voters = ["youth1@gmail.com", "youth2@gmail.com", "youth3@gmail.com", "youth4@gmail.com"]
            for i, email in enumerate(voters):
                try:
                    user = User.objects.get(email=email)
                except User.DoesNotExist:
                    continue
                if not options:
                    break
                option = options[i % len(options)]
                PollResponse.objects.get_or_create(
                    poll=first_poll, user=user, defaults=dict(option=option),
                )

        feedback_data = [
            ("youth1@gmail.com", events[0] if events else None, 5, "The leadership summit was incredibly well-organised. Speakers were spot-on."),
            ("youth2@gmail.com", events[0] if events else None, 4, "Loved the workshops. Would have appreciated more time for Q&A though."),
            ("youth3@gmail.com", None, 5, "The portal itself is so much easier to use than the old PDF forms. Thank you!"),
        ]
        for email, event, rating, comment in feedback_data:
            try:
                user = User.objects.get(email=email)
            except User.DoesNotExist:
                continue
            Feedback.objects.get_or_create(
                user=user, event=event,
                defaults=dict(rating=rating, comment=comment),
            )

        self.stdout.write(self.style.SUCCESS("  [OK] Surveys, polls, feedback seeded"))

    # --- Support Tickets ---
    def _support_tickets(self):
        from apps.support.models import SupportTicket

        admin = User.objects.filter(role="lgu_admin").first()
        tickets = [
            dict(
                email="youth1@gmail.com", name="Juan Dela Cruz",
                subject="Cannot upload SK Annual Report PDF",
                message="When I try to attach my CBYDP PDF (~3MB) the upload fails with no error message. Tried both Chrome and Edge.",
                status="resolved", priority="medium",
                resolved_at=timezone.now() - timedelta(days=5),
            ),
            dict(
                email="youth3@gmail.com", name="Pedro Bautista",
                subject="YORP application status",
                message="It has been three weeks since I submitted our org's YORP application. Could you check the status?",
                status="in_progress", priority="medium",
            ),
            dict(
                email="youth2@gmail.com", name="Maria Garcia",
                subject="Suggestion: SMS reminders for events",
                message="Many SK members in our barangay do not check email regularly. Would it be possible to add SMS reminders for upcoming events?",
                status="open", priority="low",
            ),
        ]
        for t in tickets:
            email = t["email"]
            try:
                user = User.objects.get(email=email)
            except User.DoesNotExist:
                user = None
            SupportTicket.objects.get_or_create(
                subject=t["subject"], email=email,
                defaults={**t, "user": user, "assigned_to": admin if t["status"] != "open" else None},
            )

        self.stdout.write(self.style.SUCCESS("  [OK] Support tickets seeded"))

    # --- Org Requirements ---
    def _org_requirements(self):
        from apps.youth_orgs.models import YouthOrganization, OrgRequirement

        REQS = [
            "Constitution & By-Laws",
            "List of Officers",
            "Membership Roster",
            "2024 Activity Report",
            "Letter of Endorsement (Barangay)",
            "Photo Documentation",
        ]

        for org in YouthOrganization.objects.all():
            for i, name in enumerate(REQS):
                submitted = org.is_compliant and i < 4
                OrgRequirement.objects.get_or_create(
                    organization=org, name=name,
                    defaults=dict(
                        is_submitted=submitted,
                        submitted_at=timezone.now() - timedelta(days=20) if submitted else None,
                        notes="Submitted via YORP portal." if submitted else "",
                    ),
                )

        self.stdout.write(self.style.SUCCESS("  [OK] Org requirements seeded"))

    # --- Program Submissions ---
    def _program_submissions(self):
        from apps.programs.models import ProgramSubmission, SubmissionReviewLog
        from apps.youth_orgs.models import YouthOrganization
        from django.core.files.base import ContentFile

        PLACEHOLDER = b"%PDF-1.4\n%placeholder seed\n"
        admin = User.objects.filter(role="lgu_admin").first()

        seed_subs = [
            # Completed / fully processed
            dict(
                title="Q4 2024 Linggo ng Kabataan Activity Report",
                description="Final activity report for the November 2024 Linggo ng Kabataan in Barangay 1.",
                submitter_email="youth1@gmail.com", submitter_type="sk",
                status="completed", org_name=None,
                category="active_citizenship", barangay="Barangay 1",
                location="Barangay 1 Multi-Purpose Hall",
                objectives="Document youth activities during Linggo ng Kabataan 2024.",
                target_beneficiaries="Barangay 1 youth and community members",
                expected_participants=200, actual_participants=215,
                outcomes_narrative="Successfully held 8 activities with 215 participants. Events included sports, arts, and a civic forum.",
                start_date=date.today() - timedelta(days=180),
                end_date=date.today() - timedelta(days=173),
                approved_at=timezone.now() - timedelta(days=170),
                completed_at=timezone.now() - timedelta(days=165),
            ),
            dict(
                title="SK Governance Training 2024 Final Report",
                description="Post-activity report for the SK Governance and Parliamentary Procedures training held in Q3 2024.",
                submitter_email="youth2@gmail.com", submitter_type="sk",
                status="completed", org_name=None,
                category="governance", barangay="Barangay 4",
                location="Barangay 4 Barangay Hall",
                objectives="Build governance capacity among newly elected SK officials.",
                target_beneficiaries="55 newly elected SK officers from 11 barangays",
                expected_participants=55, actual_participants=53,
                outcomes_narrative="Training completed with 96% attendance rate. Participants demonstrated improved understanding of SK governance procedures.",
                start_date=date.today() - timedelta(days=120),
                end_date=date.today() - timedelta(days=119),
                approved_at=timezone.now() - timedelta(days=115),
                completed_at=timezone.now() - timedelta(days=110),
            ),
            # Approved / In Progress
            dict(
                title="Youth Health Awareness Campaign 2025",
                description="Proposal for a 3-month health awareness campaign targeting youth in Barangay 7.",
                submitter_email="youth1@gmail.com", submitter_type="sk",
                status="in_progress", org_name=None,
                category="health", barangay="Barangay 7",
                location="Barangay 7 Health Center and Community Hall",
                objectives="Improve youth health literacy on mental health, nutrition, and reproductive health.",
                target_beneficiaries="Youth residing in Barangay 7 (approx. 320 youth)",
                expected_participants=80,
                start_date=date.today() - timedelta(days=30),
                end_date=date.today() + timedelta(days=60),
                approved_at=timezone.now() - timedelta(days=35),
            ),
            dict(
                title="Livelihood Training - Basic Sewing and Tailoring",
                description="TESDA-accredited livelihood program for out-of-school and unemployed youth in Barangay 2.",
                submitter_email="youth2@gmail.com", submitter_type="youth_org",
                status="approved", org_name="Lucena Youth Advocates",
                category="economic", barangay="Barangay 2",
                location="Barangay 2 Livelihood Center",
                objectives="Provide vocational skills to improve employment prospects of out-of-school youth.",
                target_beneficiaries="Out-of-school youth and unemployed youth in Barangay 2",
                expected_participants=50,
                start_date=date.today() + timedelta(days=7),
                end_date=date.today() + timedelta(days=67),
                approved_at=timezone.now() - timedelta(days=3),
            ),
            # Revision Requested
            dict(
                title="Youth Environmental Awareness Program",
                description="Community-based program promoting environmental stewardship and waste segregation among Barangay 10 youth.",
                submitter_email="youth5@gmail.com", submitter_type="sk",
                status="revision_requested", org_name=None,
                category="environment", barangay="Barangay 10",
                location="Barangay 10 Multi-Purpose Hall and Plaza",
                objectives="Promote waste segregation and environmental awareness among youth and community members.",
                target_beneficiaries="Youth in Barangay 10 and surrounding communities",
                expected_participants=120,
                revision_notes="Please add a detailed budget breakdown and include an endorsement letter from the Barangay Captain.",
                start_date=date.today() + timedelta(days=20),
                end_date=date.today() + timedelta(days=21),
            ),
            # Pending submissions
            dict(
                title="Digital Literacy Workshop Report - Senior Citizens",
                description="Final report for the digital literacy program led by Lucena Youth Advocates for senior citizens in Barangay 5.",
                submitter_email="youth3@gmail.com", submitter_type="youth_org",
                status="pending", org_name="Lucena Youth Advocates",
                category="education", barangay="Barangay 5",
                location="Barangay 5 Senior Citizens Center",
                objectives="Bridge the digital divide by teaching senior citizens basic smartphone and internet skills.",
                target_beneficiaries="Senior citizens aged 60+ in Barangay 5",
                expected_participants=40,
                start_date=date.today() - timedelta(days=14),
                end_date=date.today() - timedelta(days=12),
            ),
            dict(
                title="Barangay 9 SK 2025 Annual Work Plan",
                description="Annual work plan for SK Barangay 9 covering health, education, and livelihood programs for 2025.",
                submitter_email="youth5@gmail.com", submitter_type="sk",
                status="pending", org_name=None,
                category="governance", barangay="Barangay 9",
                location="Barangay 9 Barangay Hall",
                objectives="Establish a clear roadmap for SK Barangay 9's programs for the 2025 fiscal year.",
                target_beneficiaries="All youth constituents of Barangay 9 (approx. 480 youth)",
                expected_participants=50,
                start_date=date.today() + timedelta(days=30),
                end_date=date.today() + timedelta(days=395),
            ),
            dict(
                title="Youth Arts Festival 2025 Proposal",
                description="Proposal for a three-day arts and culture festival in Lucena City featuring visual arts, spoken word poetry, and traditional dance.",
                submitter_email="youth6@gmail.com", submitter_type="youth_org",
                status="pending", org_name="Green Youth Lucena",
                category="active_citizenship", barangay="Barangay 5",
                location="Lucena City Plaza and Cultural Center",
                objectives="Promote cultural identity and creative expression among Lucena City youth.",
                target_beneficiaries="Youth artists, performers, and culture enthusiasts across Lucena City",
                expected_participants=500,
                start_date=date.today() + timedelta(days=45),
                end_date=date.today() + timedelta(days=47),
            ),
            dict(
                title="Microenterprise Development Program Final Report",
                description="Final report for the 3-month microenterprise training program in Gulang-Gulang barangay.",
                submitter_email="youth6@gmail.com", submitter_type="youth_org",
                status="pending", org_name="Mayao Youth Sports Federation",
                category="economic", barangay="Gulang-Gulang",
                location="Gulang-Gulang Livelihood Center",
                objectives="Develop basic business skills and connect youth entrepreneurs with market linkages.",
                target_beneficiaries="50 out-of-school and unemployed youth in Gulang-Gulang",
                expected_participants=50,
                start_date=date.today() - timedelta(days=90),
                end_date=date.today() - timedelta(days=3),
            ),
            # Draft
            dict(
                title="Inter-Barangay Sports Festival 2025",
                description="Proposal for an inter-barangay sports festival to promote unity and healthy lifestyle among Lucena City youth.",
                submitter_email="youth8@gmail.com", submitter_type="sk",
                status="draft", org_name=None,
                category="active_citizenship", barangay="Gulang-Gulang",
                location="Lucena City Sports Complex",
                objectives="Foster camaraderie and healthy competition among youth across all 33 barangays.",
                target_beneficiaries="Youth athletes and sports enthusiasts aged 15-30 from all barangays",
                expected_participants=800,
                start_date=date.today() + timedelta(days=90),
                end_date=date.today() + timedelta(days=92),
            ),
        ]

        for s in seed_subs:
            try:
                user = User.objects.get(email=s["submitter_email"])
            except User.DoesNotExist:
                continue

            org = None
            if s.get("org_name"):
                org = YouthOrganization.objects.filter(name=s["org_name"]).first()

            if ProgramSubmission.objects.filter(title=s["title"], submitted_by=user).exists():
                continue

            sub = ProgramSubmission(
                title=s["title"],
                description=s.get("description", ""),
                submitter_type=s["submitter_type"],
                submitted_by=user,
                organization=org,
                status=s["status"],
                category=s.get("category", ""),
                objectives=s.get("objectives", ""),
                target_beneficiaries=s.get("target_beneficiaries", ""),
                location=s.get("location", ""),
                barangay=s.get("barangay", ""),
                expected_participants=s.get("expected_participants"),
                actual_participants=s.get("actual_participants"),
                outcomes_narrative=s.get("outcomes_narrative", ""),
                revision_notes=s.get("revision_notes", ""),
                start_date=s.get("start_date"),
                end_date=s.get("end_date"),
                approved_at=s.get("approved_at"),
                completed_at=s.get("completed_at"),
                reviewed_by=admin if s["status"] not in ("draft", "pending") else None,
                reviewed_at=timezone.now() - timedelta(days=5) if s["status"] not in ("draft", "pending") else None,
            )
            safe_name = s["title"].lower().replace(" ", "_")[:50]
            if s["status"] != "draft":
                sub.file.save(f"{safe_name}_seed.pdf", ContentFile(PLACEHOLDER), save=False)
            sub.save()

            # Add review log entries for processed submissions
            if s["status"] in ("approved", "in_progress", "completed", "revision_requested") and admin:
                SubmissionReviewLog.objects.get_or_create(
                    submission=sub,
                    action="submitted",
                    defaults=dict(actor=user, notes="Submitted via portal."),
                )
                if s["status"] == "revision_requested":
                    SubmissionReviewLog.objects.get_or_create(
                        submission=sub,
                        action="revision_requested",
                        defaults=dict(actor=admin, notes=s.get("revision_notes", "Please revise and resubmit.")),
                    )
                elif s["status"] in ("approved", "in_progress", "completed"):
                    SubmissionReviewLog.objects.get_or_create(
                        submission=sub,
                        action="approved",
                        defaults=dict(actor=admin, notes="Proposal meets all requirements. Approved for implementation."),
                    )
                if s["status"] == "completed":
                    SubmissionReviewLog.objects.get_or_create(
                        submission=sub,
                        action="completed",
                        defaults=dict(actor=admin, notes="Program successfully completed. Documentation accepted."),
                    )

        self.stdout.write(self.style.SUCCESS("  [OK] Program submissions seeded"))

    # --- Volunteer Opportunities ---
    def _volunteer_opportunities(self):
        from apps.volunteers.models import VolunteerOpportunity

        admin = User.objects.filter(role="lgu_admin").first()
        opportunities = [
            dict(
                title="Brigada Eskwela 2025 - Youth Volunteers",
                description="Help repair and clean Lucena public schools before the school year starts. Hands-on, week-long volunteer drive.",
                organization="DepEd Quezon",
                location="Various public schools, Lucena City",
                tags=["education", "community", "manual-labor"],
                slots=80,
                start_date=date.today() + timedelta(days=20),
                end_date=date.today() + timedelta(days=27),
                is_active=True,
            ),
            dict(
                title="Coastal Clean-Up - Sta. Lucia Shoreline",
                description="Quarterly coastal clean-up drive in partnership with the City ENRO. Free meals and certificate provided.",
                organization="Lucena City ENRO",
                location="Sta. Lucia Shoreline, Lucena City",
                tags=["environment", "outdoor", "one-day"],
                slots=50,
                start_date=date.today() + timedelta(days=30),
                end_date=date.today() + timedelta(days=30),
                is_active=True,
            ),
            dict(
                title="Linggo ng Kabataan 2025 Marshals",
                description="Become a youth marshal during Linggo ng Kabataan week - guide attendees, manage stalls, and document the event.",
                organization="LYDO Lucena",
                location="Lucena City Plaza & City Hall",
                tags=["governance", "events", "leadership"],
                slots=30,
                start_date=date.today() + timedelta(days=60),
                end_date=date.today() + timedelta(days=66),
                is_active=True,
            ),
        ]

        for d in opportunities:
            VolunteerOpportunity.objects.get_or_create(
                title=d["title"],
                defaults={**d, "posted_by": admin},
            )

        self.stdout.write(self.style.SUCCESS("  [OK] Volunteer opportunities seeded"))
