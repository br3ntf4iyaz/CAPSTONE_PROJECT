from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0004_add_choices_to_survey_question'),
    ]

    operations = [
        migrations.AddField(
            model_name='event',
            name='check_in_active',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='event',
            name='check_in_code',
            field=models.CharField(blank=True, max_length=6),
        ),
    ]
