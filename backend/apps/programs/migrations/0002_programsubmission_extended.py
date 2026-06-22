from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('programs', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # 1. Alter status field — expand choices, max_length=25, default='draft'
        migrations.AlterField(
            model_name='programsubmission',
            name='status',
            field=models.CharField(
                choices=[
                    ('draft', 'Draft'),
                    ('pending', 'Pending Review'),
                    ('revision_requested', 'Revision Requested'),
                    ('approved', 'Approved'),
                    ('in_progress', 'In Progress'),
                    ('completion_submitted', 'Completion Submitted'),
                    ('completed', 'Completed'),
                    ('rejected', 'Rejected'),
                ],
                default='draft',
                max_length=25,
            ),
        ),
        # 2. Make file nullable
        migrations.AlterField(
            model_name='programsubmission',
            name='file',
            field=models.FileField(blank=True, null=True, upload_to='program_submissions/'),
        ),
        # 3. Add updated_at
        migrations.AddField(
            model_name='programsubmission',
            name='updated_at',
            field=models.DateTimeField(auto_now=True),
        ),
        # 4. Add new fields to ProgramSubmission
        migrations.AddField(
            model_name='programsubmission',
            name='category',
            field=models.CharField(
                blank=True,
                choices=[
                    ('social_inclusion', 'Social Inclusion and Equity'),
                    ('health', 'Health'),
                    ('active_citizenship', 'Active Citizenship'),
                    ('peace_building', 'Peace Building and Security'),
                    ('education', 'Education'),
                    ('environment', 'Environment'),
                    ('governance', 'Governance'),
                    ('agriculture', 'Agriculture'),
                    ('global_mobility', 'Global Mobility'),
                    ('economic', 'Economic Environment'),
                ],
                max_length=30,
            ),
        ),
        migrations.AddField(
            model_name='programsubmission',
            name='objectives',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='programsubmission',
            name='target_beneficiaries',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='programsubmission',
            name='start_date',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='programsubmission',
            name='end_date',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='programsubmission',
            name='location',
            field=models.CharField(blank=True, max_length=200),
        ),
        migrations.AddField(
            model_name='programsubmission',
            name='barangay',
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name='programsubmission',
            name='expected_participants',
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='programsubmission',
            name='estimated_budget',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True),
        ),
        migrations.AddField(
            model_name='programsubmission',
            name='thumbnail',
            field=models.ImageField(blank=True, null=True, upload_to='submission_thumbnails/'),
        ),
        migrations.AddField(
            model_name='programsubmission',
            name='revision_notes',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='programsubmission',
            name='actual_participants',
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='programsubmission',
            name='outcomes_narrative',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='programsubmission',
            name='completion_report_file',
            field=models.FileField(blank=True, null=True, upload_to='completion_reports/'),
        ),
        migrations.AddField(
            model_name='programsubmission',
            name='reviewed_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='reviewed_submissions',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='programsubmission',
            name='reviewed_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='programsubmission',
            name='approved_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='programsubmission',
            name='completed_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        # 5. Add new indexes on ProgramSubmission
        migrations.AddIndex(
            model_name='programsubmission',
            index=models.Index(fields=['category'], name='programs_ps_categor_idx'),
        ),
        migrations.AddIndex(
            model_name='programsubmission',
            index=models.Index(fields=['start_date'], name='programs_ps_start_d_idx'),
        ),
        # 6. Create SubmissionAttachment model
        migrations.CreateModel(
            name='SubmissionAttachment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('kind', models.CharField(
                    choices=[
                        ('main_proposal', 'Main Proposal'),
                        ('supporting', 'Supporting Document'),
                        ('progress_photo', 'Progress Photo'),
                        ('completion_photo', 'Completion Photo'),
                    ],
                    default='supporting',
                    max_length=20,
                )),
                ('file', models.FileField(upload_to='submission_attachments/')),
                ('label', models.CharField(blank=True, max_length=200)),
                ('uploaded_at', models.DateTimeField(auto_now_add=True)),
                ('submission', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='attachments',
                    to='programs.programsubmission',
                )),
                ('uploaded_by', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'ordering': ['kind', 'uploaded_at'],
            },
        ),
        # 7. Create SubmissionReviewLog model
        migrations.CreateModel(
            name='SubmissionReviewLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('action', models.CharField(
                    choices=[
                        ('submitted', 'Submitted'),
                        ('revision_requested', 'Revision Requested'),
                        ('approved', 'Approved'),
                        ('rejected', 'Rejected'),
                        ('in_progress_marked', 'Marked In Progress'),
                        ('completion_submitted', 'Completion Submitted'),
                        ('completed', 'Completed'),
                    ],
                    max_length=30,
                )),
                ('notes', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('submission', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='review_logs',
                    to='programs.programsubmission',
                )),
                ('actor', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'ordering': ['created_at'],
            },
        ),
    ]
