from django.db import migrations


def seed(apps, schema_editor):
    Requirement = apps.get_model('compliance', 'DisclosureRequirement')
    if not Requirement.objects.exists():
        Requirement.objects.create(
            title='Quarterly Financial Transaction Report',
            description='Report of financial transactions for the quarter. Due April 7, July 7, October 7 and January 7 of the following year.',
            frequency='quarterly', order=1,
        )


def unseed(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [('compliance', '0003_disclosurerequirement_disclosuresubmission')]
    operations = [migrations.RunPython(seed, unseed)]
