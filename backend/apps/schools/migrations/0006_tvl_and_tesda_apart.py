from django.db import migrations, models


def private_techvoc_are_tesda(apps, schema_editor):
    """The private schools that were listed under Tech-Voc / TESDA are TESDA providers too; the public ones are Tech-Voc (TVL) only."""
    School = apps.get_model('schools', 'School')
    School.objects.filter(offers_tvl=True).exclude(school_type__in=['public', 'state_university']).update(tesda_provider=True)


class Migration(migrations.Migration):

    dependencies = [
        ('schools', '0005_senior_high_finder'),
    ]

    operations = [
        migrations.RenameField(model_name='school', old_name='in_techvoc', new_name='offers_tvl'),
        migrations.AlterField(
            model_name='school', name='offers_tvl',
            field=models.BooleanField(default=False, help_text='Tech-Voc: the school offers the Technical-Vocational-Livelihood (TVL) track of Senior High School.'),
        ),
        migrations.AddField(
            model_name='school', name='tesda_provider',
            field=models.BooleanField(default=False, help_text='TESDA: the school gives TESDA training programs (NC levels). This is separate from Senior High School.'),
        ),
        migrations.RunPython(private_techvoc_are_tesda, migrations.RunPython.noop),
    ]
