from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0004_user_email_verification'),
    ]

    operations = [
        migrations.RenameField(
            model_name='profile',
            old_name='linkedin_url',
            new_name='facebook_url',
        ),
    ]
