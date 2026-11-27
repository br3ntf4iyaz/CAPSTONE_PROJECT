"""Add a few Lucena City youth clubs as DEMO entries, so the directory is not empty while the system is built.

These entries are NOT verified. The public web pages first used to find them could not be opened when checked, so their existence and
details are not independently confirmed. Nothing beyond the club name is claimed: no projects, officers, contact numbers, emails or
registration numbers, and none is marked as registered with LYDO. They are listed as "Not Yet Registered".
LYDO can confirm, edit or delete them in Admin, Youth Organizations.

Safe to run again. An entry added earlier is brought to this wording only while nobody has edited it.

    python manage.py add_public_orgs
"""
from django.core.management.base import BaseCommand

from apps.youth_orgs.models import YouthOrganization, ensure_default_requirements

NOTE = ('Added for the system demo. NOT verified: the public web pages first used to find this club could not be opened when checked '
        '(28 Nov 2026), so its existence and details are not independently confirmed. Confirm it with the club or LYDO, or delete this entry. '
        'Shown as Open for Members for the demo only: LYDO can close it.')
DESCRIPTION = 'Rotaract club based in Lucena City. This is a demo listing: the details of this club have not been confirmed yet.'
OLD_HOW = 'Membership details for this organization are not confirmed yet. Please contact the LYDO office to be guided to the organization.'
HOW = 'Demo listing: to join, contact the organization directly, or ask the LYDO office to guide you to it.'

NAMES = ['Rotaract Club of Lucena South', 'Rotaract Club of Metro Lucena', 'Rotaract Club of Lucena Promenade']

# what this command wrote before: replaced only while an entry still has exactly this text (so LYDO's edits are never overwritten)
OLD_DESCRIPTIONS = {
    'Rotaract Club of Lucena South': ('Rotaract club in Lucena City, sponsored by the Rotary Club of Lucena South. It marked its 25th charter anniversary in 2025. '
                                      'Its projects include Project SEKYU, which honors night-shift guards and barangay tanods, and a dental outreach for students.'),
    'Rotaract Club of Metro Lucena': 'Rotaract club in Lucena City. It has co-run a barangay HIV and AIDS awareness symposium together with the Rotary Club of Metro Lucena.',
    'Rotaract Club of Lucena Promenade': ('Rotaract club in Lucena City. DTI Quezon held a collaborative meeting with the club about partnership projects '
                                          'for its adopted schools and community.'),
}
OLD_SOURCES = (
    'https://rotaract.rotaryphilippines.com/?p=5507',
    'https://rotaract.rotaryphilippines.com/?p=3662',
    'https://dti.gov.ph/archives/regional-archives/region-4a-news-regional-archives/dti-quezon-rotaract-club-lucena-promenade-hold-collaborative-meeting-youth-sector',
)


class Command(BaseCommand):
    help = 'Add the demo Lucena youth clubs (not verified; LYDO confirms, edits or deletes them).'

    def add_arguments(self, parser):
        parser.add_argument('--open-existing', action='store_true',
                            help='Also open for members the demo entries added earlier, if nobody at LYDO has edited their how-to-join text.')

    def handle(self, *args, **options):
        added = 0
        for name in NAMES:
            org, created = YouthOrganization.objects.get_or_create(
                name=name,
                defaults=dict(
                    classification='community_based',
                    sub_classification='youth_serving',
                    registration_category='not_registered',
                    barangay='',
                    description=DESCRIPTION,
                    how_to_join=HOW,
                    application_mode='contact',
                    accepting_members=True,  # open for the demo: the system is not in real use yet
                    is_active=True,
                    status='approved',
                    admin_notes=NOTE,
                ),
            )
            if created:
                ensure_default_requirements(org)
                added += 1
                self.stdout.write(self.style.SUCCESS(f'  added: {name}'))
                continue
            changed = []
            if org.description == OLD_DESCRIPTIONS.get(name):  # still the text written before: bring it to the cautious wording
                org.description = DESCRIPTION
                changed.append('description')
            if org.source_url in OLD_SOURCES:  # a link that does not open is not a source
                org.source_url = ''
                changed.append('source_url')
            if changed and org.admin_notes.startswith('Added from public sources'):
                org.admin_notes = NOTE
                changed.append('admin_notes')
            if options['open_existing'] and org.how_to_join == OLD_HOW and not org.accepting_members:
                org.accepting_members, org.how_to_join = True, HOW  # only the untouched demo entry
                changed += ['accepting_members', 'how_to_join']
            if changed:
                org.save(update_fields=changed)
                self.stdout.write(self.style.SUCCESS(f'  updated {name}: {", ".join(changed)}'))
            else:
                self.stdout.write(f'  already there: {name}')
        self.stdout.write(self.style.SUCCESS(f'Done. {added} added.'))
