from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('programs', '0002_programsubmission_extended'),
    ]

    operations = [
        migrations.CreateModel(
            name='FeaturedSlide',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=300)),
                ('description', models.TextField()),
                ('organizer', models.CharField(max_length=200)),
                ('tag_type', models.CharField(
                    choices=[
                        ('lydo_program', 'LYDO Program'),
                        ('sk_activity', 'SK Activity'),
                        ('community_event', 'Community Event'),
                        ('lydo_assembly', 'LYDO Assembly'),
                        ('other', 'Other'),
                    ],
                    default='lydo_program',
                    max_length=20,
                )),
                ('image', models.ImageField(blank=True, null=True, upload_to='featured_slides/')),
                ('order', models.PositiveIntegerField(db_index=True, default=0)),
                ('is_active', models.BooleanField(db_index=True, default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'ordering': ['order', '-created_at'],
            },
        ),
    ]
