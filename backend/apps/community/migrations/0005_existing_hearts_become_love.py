from django.db import migrations


def hearts_to_love(apps, schema_editor):
    # Before this change a reaction was a heart, so every existing one becomes "love".
    apps.get_model('community', 'PostReaction').objects.update(reaction_type='love')


class Migration(migrations.Migration):
    dependencies = [('community', '0004_communitycomment_hidden_at_and_more')]
    operations = [migrations.RunPython(hearts_to_love, migrations.RunPython.noop)]
