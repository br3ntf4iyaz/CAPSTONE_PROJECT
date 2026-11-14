from django.core.management.base import BaseCommand

from apps.support.models import FAQ

FAQS = [
    ("Account", "How do I create an account?", "Click Register, fill in your details and verify your email using the link we send you. Then complete your profile."),
    ("Account", "I forgot my password. What do I do?", "On the login page click Forgot password, enter your email and follow the reset link."),
    ("Verification", "How do I verify my identity?", "Open Verify Identity, choose your ID type, scan the front and back with your camera, then take a live selfie. A LYDO admin reviews it and approves your verified badge."),
    ("Verification", "Why was my ID rejected?", "Usually the photo was blurry, cropped, or the face did not match. Retake the photos in good light and submit again."),
    ("Opportunities", "How do I apply for a scholarship or job?", "Open the listing, press Apply, confirm the requirements, fill in your details and submit. You can see it in your applications afterwards."),
    ("Events", "How do I join an event?", "Go to Events, open the event and press Register. Check the calendar for the schedule."),
    ("Learning", "How do I get a certificate?", "Finish all lessons and pass the quiz of a course. Your certificate appears under Certificates."),
    ("SK and Organizations", "How does a youth organization register in YORP?", "Organization leaders can apply online under YORP Registration and track the status and requirements there."),
    ("Privacy", "Is my personal information safe?", "Your data is used only for LYDO services under the Data Privacy Act. See the Privacy page for details."),
]


class Command(BaseCommand):
    help = "Seed starter FAQs for the Help Center (idempotent)."

    def handle(self, *args, **options):
        created = 0
        for i, (cat, q, a) in enumerate(FAQS):
            _, was_created = FAQ.objects.get_or_create(
                question=q, defaults={"category": cat, "answer": a, "order": i, "is_published": True}
            )
            created += was_created
        self.stdout.write(self.style.SUCCESS(f"FAQs created: {created}"))
