"""Remove job applications made while testing (rows AND their private files). Shows what it would do unless --yes is given.

    python manage.py clear_job_applications            # only lists
    python manage.py clear_job_applications --yes      # really deletes
    python manage.py clear_job_applications --yes --email test@example.com   # only this applicant's
"""
from django.core.management.base import BaseCommand

from apps.applications.models import OpportunityApplication

FILES = ('document', 'id_document', 'id_document_back', 'selfie')


class Command(BaseCommand):
    help = 'Delete job applications (and their uploaded files). Dry run unless --yes.'

    def add_arguments(self, parser):
        parser.add_argument('--yes', action='store_true', help='Really delete.')
        parser.add_argument('--email', help='Only the applications of this applicant email.')

    def handle(self, *args, yes=False, email=None, **opts):
        qs = OpportunityApplication.objects.filter(kind='job')
        if email:
            qs = qs.filter(applicant__email__iexact=email)
        for a in qs:
            self.stdout.write(f'  #{a.pk} {a.full_name} -> {a.title} [{a.status}]')
        self.stdout.write(f'{qs.count()} job application(s).')
        if not yes:
            self.stdout.write('Nothing deleted. Run again with --yes to delete them.')
            return
        n = 0
        for a in qs:
            for name in FILES:
                f = getattr(a, name)
                if f:
                    f.delete(save=False)
            a.delete()
            n += 1
        self.stdout.write(self.style.SUCCESS(f'Deleted {n} job application(s). The audit log is kept.'))
