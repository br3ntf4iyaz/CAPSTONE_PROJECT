"""List schools in the School Finder that look like the same school written twice, so LYDO can merge or archive one.

Nothing is changed. Two schools are listed together when their names, after leaving out common words (college, inc., school, Lucena...),
share most of their words. Run it after adding schools:

    python manage.py find_duplicate_schools
"""
import re

from django.core.management.base import BaseCommand

from apps.schools.models import School

COMMON = {'college', 'colleges', 'school', 'schools', 'inc', 'incorporated', 'foundation', 'institute', 'institution', 'lucena', 'city', 'campus',
          'of', 'the', 'and', 'for', 'educational', 'education', 'system', 'center', 'centre', 'training', 'assessment', 'technological', 'technical',
          'national', 'high', 'integrated', 'university', 'extension', 'annex', 'main', 'quezon', 'province', 'a', 'de', 'ng', 'sa'}


def words(name):
    cleaned = re.sub(r'\([^)]*\)', ' ', name.lower())
    return {w for w in re.sub(r'[^a-z0-9]+', ' ', cleaned).split() if w not in COMMON and len(w) > 1}


class Command(BaseCommand):
    help = 'List schools that look like duplicates (nothing is changed).'

    def handle(self, *args, **options):
        schools = list(School.objects.filter(is_active=True).order_by("name"))
        found = []
        for i, a in enumerate(schools):
            wa = words(a.name)
            for b in schools[i + 1:]:
                wb = words(b.name)
                if not wa or not wb:
                    continue
                overlap = len(wa & wb) / min(len(wa), len(wb))
                if overlap >= 0.75:
                    found.append((a, b))
        if not found:
            self.stdout.write(self.style.SUCCESS('No duplicate-looking schools.'))
            return
        self.stdout.write(f'{len(found)} pair(s) that look like the same school:')
        for a, b in found:
            self.stdout.write(f'  [{a.pk}] {a.name} ({"active" if a.is_active else "archived"})  <->  [{b.pk}] {b.name} ({"active" if b.is_active else "archived"})')
