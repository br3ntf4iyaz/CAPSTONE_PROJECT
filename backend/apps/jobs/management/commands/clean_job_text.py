import re

from django.core.management.base import BaseCommand

from apps.jobs.models import JobOpportunity

MOJIBAKE = {
    "â€”": "—",  # em dash
    "â€“": "–",  # en dash
    "â€¢": "•",  # bullet
    "â‚±": "₱",  # peso
    "Â·": "·",
}


def fix(text: str) -> str:
    if not text:
        return text
    for bad, good in MOJIBAKE.items():
        text = text.replace(bad, good)
    text = re.sub(r"\?(?=\d)", "₱", text)              # ?24,000 -> peso
    text = re.sub(r"(?<=[\w\)]) \? (?=\W?[\w₱])", " – ", text)  # A ? B -> A - B
    text = re.sub(r"(?m)^\? ", "• ", text)             # bullet at line start
    text = re.sub(r"(?m)^(\s*)\?(?=\S)", r"\1• ", text)
    return text


class Command(BaseCommand):
    help = "Repair '?' / mojibake characters in job listings and remove exact duplicates."

    def handle(self, *args, **opts):
        fixed = 0
        for j in JobOpportunity.objects.all():
            changed = False
            for f in ("title", "company_or_org", "location", "description", "requirements", "salary_range"):
                v = getattr(j, f)
                if isinstance(v, str):
                    nv = fix(v)
                    if nv != v:
                        setattr(j, f, nv)
                        changed = True
            if changed:
                j.save()
                fixed += 1

        seen, removed = {}, 0
        for j in JobOpportunity.objects.order_by("id"):
            key = (j.title.strip().lower(), j.company_or_org.strip().lower())
            if key in seen:
                j.delete()
                removed += 1
            else:
                seen[key] = j.id
        self.stdout.write(self.style.SUCCESS(f"Repaired: {fixed}, duplicates removed: {removed}"))
