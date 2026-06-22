import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('sk_requirements', '0002_add_logo_to_skbarangay'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='SKFeedback',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('category', models.CharField(
                    choices=[('concern', 'Concern'), ('suggestion', 'Suggestion'), ('praise', 'Praise')],
                    default='concern', max_length=20,
                )),
                ('subject', models.CharField(max_length=200)),
                ('message', models.TextField(max_length=2000)),
                ('rating', models.PositiveSmallIntegerField(blank=True, null=True)),
                ('is_anonymous', models.BooleanField(default=False)),
                ('status', models.CharField(
                    choices=[('received', 'Received'), ('acknowledged', 'Acknowledged'), ('resolved', 'Resolved')],
                    default='received', max_length=20,
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('barangay', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='feedback',
                    to='sk_requirements.skbarangay',
                )),
                ('submitted_by', models.ForeignKey(
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]
