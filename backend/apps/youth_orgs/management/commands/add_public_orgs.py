"""Add a few youth and student organizations of Lucena City, as demo entries, so the directory is not empty while the system is built.

Each one below was found on a public web page that was OPENED and READ (see `source`). Only what that page says is written. No officers,
contact numbers, emails or registration numbers are invented, and none is marked as registered with LYDO. All are "Not Yet Registered":
LYDO must confirm them. LYDO can confirm, edit or delete them in Admin, Youth Organizations.

The three Rotaract clubs added in an earlier version could not be confirmed (their source pages did not open). This command removes
them, but only while nobody has edited them.

Safe to run again.

    python manage.py add_public_orgs
"""
from django.core.management.base import BaseCommand

from apps.youth_orgs.models import YouthOrganization, ensure_default_requirements

DEMO_NOTE = ('Added for the system demo from a public web page (see the source link). Not yet confirmed by LYDO: confirm the name, officers and '
             'contact details with the organization, then set the registration category. Edit or delete this entry freely.')

SLSU = 'https://www.slsu.edu.ph/accredited-student-organizations/'
LUZONIAN = 'https://theluzonian.press/ucsc-kny-lucena-create-donation-drive-for-kristine-victims/'

ORGS = [
    dict(
        name='Supreme Student Council - SLSU Lucena Campus',
        classification='school_based', sub_classification='youth_org',
        description='The Supreme Student Council of the Lucena Campus of Southern Luzon State University (SLSU). It is listed among the accredited student organizations of SLSU.',
        how_to_join='A student council is joined through the school: ask the SLSU Lucena Campus student affairs office about its elections and membership.',
        accepting_members=False,  # student council seats are filled by election, so it is not recruiting members
        accent='emerald',
        source=SLSU,
    ),
    dict(
        name='University Collegiate Student Council - MSEUF',
        classification='school_based', sub_classification='youth_org',
        description=('The University Collegiate Student Council (UCSC) of Manuel S. Enverga University Foundation (MSEUF). Its office is in the '
                     'Office of Student Affairs and Services building of the university. In October 2024 it joined a donation drive for the victims of '
                     'Severe Tropical Storm Kristine.'),
        how_to_join='A student council is joined through the school: ask the MSEUF Office of Student Affairs and Services about its elections and membership.',
        accepting_members=False,
        accent='rose',
        source=LUZONIAN,
    ),
    dict(
        name='Kaya Natin! Youth - Lucena',
        classification='community_based', sub_classification='youth_org',
        description=('The Lucena chapter of Kaya Natin! Youth (KNY). In October 2024 it teamed up with the '
                     'MSEUF student council to collect in-kind donations for the victims of Severe Tropical Storm Kristine, and it also took donations online.'),
        how_to_join='Demo listing: use the button below to apply for membership in LYDOP.',
        application_mode='in_app',  # the one demo club that takes applications inside LYDOP, so the join flow can be shown
        accepting_members=True,  # open for the demo: the system is not in real use yet
        accent='amber',
        source=LUZONIAN,
    ),
]

# how the two descriptions were first written, replaced only while an entry still has exactly this text
FIRST_DESCRIPTIONS = {
    'University Collegiate Student Council - MSEUF': ('The University Collegiate Student Council (UCSC) of Manuel S. Enverga University Foundation (MSEUF). In October 2024, together with '
                                                      'Kaya Natin! Youth - Lucena, it ran an in-kind donation drive for the victims of Severe Tropical Storm Kristine.'),
    'Kaya Natin! Youth - Lucena': ('The Lucena chapter of Kaya Natin! Youth (KNY). In October 2024, together with the University Collegiate Student Council of MSEUF, '
                                   'it ran an in-kind donation drive for the victims of Severe Tropical Storm Kristine.'),
}

# what the Kaya Natin! entry said while it was contact-only: switched to applying in LYDOP only while still exactly this
KNY_CONTACT_HOW = 'Demo listing: to join, contact the organization directly, or ask the LYDO office to guide you to it.'

# the clubs this command added before, which could not be confirmed. They are removed only while untouched.
UNVERIFIED = ['Rotaract Club of Lucena South', 'Rotaract Club of Metro Lucena', 'Rotaract Club of Lucena Promenade']
UNVERIFIED_MARKS = ('Added from public sources for the system demo.', 'Added for the system demo. NOT verified')


class Command(BaseCommand):
    help = 'Add the demo Lucena youth and student organizations found on public pages (not yet confirmed by LYDO).'

    def handle(self, *args, **options):
        removed = 0
        for name in UNVERIFIED:
            for org in YouthOrganization.objects.filter(name=name):
                if org.admin_notes.startswith(UNVERIFIED_MARKS) and not org.membership_applications.exists():
                    org.delete()
                    removed += 1
                    self.stdout.write(self.style.WARNING(f'  removed (could not be confirmed): {name}'))
                else:
                    self.stdout.write(f'  kept (it was edited or has applications): {name}')

        added = 0
        for d in ORGS:
            org, created = YouthOrganization.objects.get_or_create(
                name=d['name'],
                defaults=dict(
                    classification=d['classification'], sub_classification=d['sub_classification'],
                    registration_category='not_registered', barangay='',
                    description=d['description'], how_to_join=d['how_to_join'],
                    application_mode=d.get('application_mode', 'contact'), accepting_members=d['accepting_members'],
                    is_active=True, status='approved', admin_notes=DEMO_NOTE, source_url=d['source'], accent=d['accent'],
                ),
            )
            if created:
                ensure_default_requirements(org)
                added += 1
                self.stdout.write(self.style.SUCCESS(f'  added: {org.name}'))
            else:
                changed = []
                if not org.accent:  # an entry added before colours existed gets one; a colour somebody chose is never changed
                    org.accent = d['accent']
                    changed.append('accent')
                if org.description == FIRST_DESCRIPTIONS.get(d['name']):  # untouched: bring it to the new wording
                    org.description = d['description']
                    changed.append('description')
                if d.get('application_mode') == 'in_app' and org.application_mode == 'contact' and org.how_to_join == KNY_CONTACT_HOW:
                    org.application_mode, org.how_to_join = 'in_app', d['how_to_join']  # untouched: now takes applications in LYDOP
                    changed += ['application_mode', 'how_to_join']
                if changed:
                    org.save(update_fields=changed)
                    self.stdout.write(self.style.SUCCESS(f'  updated {org.name}: {", ".join(changed)}'))
                else:
                    self.stdout.write(f'  already there: {org.name}')
        self.stdout.write(self.style.SUCCESS(f'Done. {added} added, {removed} removed.'))
