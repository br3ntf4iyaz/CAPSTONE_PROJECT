from django.db import migrations


def backfill(apps, schema_editor):
    """Existing enrollments keep working: their certificate name starts as the learner's account name.
    The learner can still change it before the certificate is issued."""
    Enrollment = apps.get_model('courses', 'Enrollment')
    for enrollment in Enrollment.objects.filter(certificate_name='').select_related('user'):
        user = enrollment.user
        name = f'{user.first_name} {user.last_name}'.strip() or user.email
        enrollment.certificate_name = name[:150]
        enrollment.save(update_fields=['certificate_name'])


class Migration(migrations.Migration):
    dependencies = [('courses', '0006_lms_audience_certificate_video')]
    operations = [migrations.RunPython(backfill, migrations.RunPython.noop)]
