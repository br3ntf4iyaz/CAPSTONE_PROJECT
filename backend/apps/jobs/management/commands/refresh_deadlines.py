import re
from datetime import date, timedelta

from django.core.management.base import BaseCommand

from apps.jobs.models import JobOpportunity
from apps.resources.models import Scholarship


class Command(BaseCommand):
    help = "Move expired job/scholarship deadlines into the future so listings are open for applications."

    def add_arguments(self, parser):
        parser.add_argument("--days", type=int, default=30, help="Minimum days ahead for the first listing.")

    def handle(self, *args, **opts):
        today = date.today()
        base = opts["days"]
        jobs = 0
        for i, j in enumerate(JobOpportunity.objects.filter(application_deadline__lt=today).order_by("id")):
            j.application_deadline = today + timedelta(days=base + (i * 3) % 60)
            j.save(update_fields=["application_deadline"])
            jobs += 1

        schs = 0
        iso = re.compile(r"^\d{4}-\d{2}-\d{2}$")
        for i, s in enumerate(Scholarship.objects.all().order_by("id")):
            if iso.match(s.deadline or "") and s.deadline < today.isoformat():
                s.deadline = (today + timedelta(days=base + (i * 5) % 90)).isoformat()
                s.save(update_fields=["deadline"])
                schs += 1
        self.stdout.write(self.style.SUCCESS(f"Jobs updated: {jobs}, scholarships updated: {schs}"))
