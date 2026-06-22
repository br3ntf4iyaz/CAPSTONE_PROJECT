import uuid
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0003_alter_user_role'),
    ]

    operations = [
        # Add is_email_verified field — existing users default to True so they
        # are not locked out of their accounts after the migration runs.
        migrations.AddField(
            model_name='user',
            name='is_email_verified',
            field=models.BooleanField(default=True),
        ),
        # After adding the field with default=True (so existing rows are fine),
        # change the model default to False for new self-registered users.
        migrations.AlterField(
            model_name='user',
            name='is_email_verified',
            field=models.BooleanField(default=False),
        ),
        # Create EmailVerificationToken table
        migrations.CreateModel(
            name='EmailVerificationToken',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('token', models.UUIDField(default=uuid.uuid4, editable=False, unique=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='email_verification_token',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
        ),
    ]
