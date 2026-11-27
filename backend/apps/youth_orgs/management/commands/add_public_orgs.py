"""Add the youth organizations of Lucena City that are documented in public sources, so the directory is not empty while the system is built.

Only what the public sources say is written. No contact numbers, emails, officers or registration numbers are invented, and none of
them is marked as registered with LYDO. They are listed as "Not Yet Registered" until the LYDO office confirms them. LYDO can edit or
delete them in Admin, Youth Orgs / YORP.

Safe to run again: an organization that already exists (same name) is left as it is.

    python manage.py add_public_orgs
"""
from django.core.management.base import BaseCommand

from apps.youth_orgs.models import YouthOrganization, ensure_default_requirements

NOTE = ('Added from public sources for the system demo. Not yet confirmed by LYDO: confirm the name, officers and contact details, '
        'then set the registration category. Shown as Open for Members for the demo only: LYDO can close it. Edit or delete this entry freely.')
OLD_HOW = 'Membership details for this organization are not confirmed yet. Please contact the LYDO office to be guided to the organization.'
HOW = 'Demo listing: to join, contact the organization directly, or ask the LYDO office to guide you to it.'

ORGS = [
    dict(
        name='Rotaract Club of Lucena South',
        description=('Rotaract club in Lucena City, sponsored by the Rotary Club of Lucena South. It marked its 25th charter anniversary in 2025. '
                     'Its projects include Project SEKYU, which honors night-shift guards and barangay tanods, and a dental outreach for students.'),
        source='https://rotaract.rotaryphilippines.com/?p=5507',
    ),
    dict(
        name='Rotaract Club of Metro Lucena',
        description=('Rotaract club in Lucena City. It has co-run a barangay HIV and AIDS awareness symposium together with the Rotary Club of Metro Lucena.'),
        source='https://rotaract.rotaryphilippines.com/?p=3662',
    ),
    dict(
        name='Rotaract Club of Lucena Promenade',
        description=('Rotaract club in Lucena City. DTI Quezon held a collaborative meeting with the club about partnership projects for its adopted schools and community.'),
        source='https://dti.gov.ph/archives/regional-archives/region-4a-news-regional-archives/dti-quezon-rotaract-club-lucena-promenade-hold-collaborative-meeting-youth-sector',
    ),
]


class Command(BaseCommand):
    help = 'Add the Lucena youth organizations found in public sources (demo entries, not yet confirmed by LYDO).'

    def add_arguments(self, parser):
        parser.add_argument('--open-existing', action='store_true',
                            help='Also open for members the demo entries added earlier, if nobody at LYDO has edited their how-to-join text.')

    def handle(self, *args, **options):
        added = 0
        for d in ORGS:
            org, created = YouthOrganization.objects.get_or_create(
                name=d['name'],
                defaults=dict(
                    classification='community_based',
                    sub_classification='youth_serving',
                    registration_category='not_registered',
                    barangay='',
                    description=d['description'],
                    how_to_join=HOW,
                    application_mode='contact',
                    accepting_members=True,  # open for the demo: the system is not in real use yet
                    is_active=True,
                    status='approved',
                    admin_notes=NOTE,
                    source_url=d['source'],
                ),
            )
            if not created and not org.source_url:  # an entry added earlier gets its source, nothing else changes
                org.source_url = d['source']
                org.save(update_fields=['source_url'])
            if not created and options['open_existing'] and org.how_to_join == OLD_HOW and not org.accepting_members:
                # only the untouched demo entry: LYDO's own edits are never overwritten
                org.accepting_members, org.how_to_join = True, HOW
                org.save(update_fields=['accepting_members', 'how_to_join'])
                self.stdout.write(self.style.SUCCESS(f'  opened for members: {org.name}'))
            if created:
                ensure_default_requirements(org)
                added += 1
                self.stdout.write(self.style.SUCCESS(f'  added: {org.name}'))
            else:
                self.stdout.write(f'  already there: {org.name}')
        self.stdout.write(self.style.SUCCESS(f'Done. {added} added.'))
