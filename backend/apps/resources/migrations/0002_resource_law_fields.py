from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('resources', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='resource',
            name='law_number',
            field=models.CharField(
                blank=True,
                help_text='e.g. RA 10742, EO 123, DILG MC 2020-091',
                max_length=50,
            ),
        ),
        migrations.AddField(
            model_name='resource',
            name='year_enacted',
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='resource',
            name='tags',
            field=models.CharField(
                blank=True,
                help_text='Comma-separated tags',
                max_length=500,
            ),
        ),
        migrations.AlterField(
            model_name='resource',
            name='external_url',
            field=models.URLField(blank=True, max_length=1000),
        ),
    ]
