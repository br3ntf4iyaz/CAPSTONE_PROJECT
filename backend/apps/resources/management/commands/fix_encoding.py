"""
Management command: fix_encoding

Fixes Mojibake (UTF-8 bytes misread as Windows-1252) in database text fields.

The corruption occurs when UTF-8 multibyte sequences are interpreted as
Windows-1252 single bytes. e.g. em dash U+2014 (UTF-8: E2 80 94) becomes:
  E2 -> U+00E2 (a with circumflex)
  80 -> U+20AC (euro sign, via cp1252 byte 0x80)
  94 -> U+201D (right double quote, via cp1252 byte 0x94)

Run:
    python manage.py fix_encoding
    python manage.py fix_encoding --dry-run
"""

from django.core.management.base import BaseCommand

# ---------------------------------------------------------------------------
# Mojibake replacement table — built with explicit chr() to avoid any
# encoding ambiguity in this source file.
# ---------------------------------------------------------------------------
# Windows-1252 byte mappings for the high-byte range:
#   0x80 -> U+20AC (EURO SIGN)
#   0x91 -> U+2018 (LEFT SINGLE QUOTATION MARK)
#   0x92 -> U+2019 (RIGHT SINGLE QUOTATION MARK)
#   0x93 -> U+201C (LEFT DOUBLE QUOTATION MARK)
#   0x94 -> U+201D (RIGHT DOUBLE QUOTATION MARK)
#   0x96 -> U+2013 (EN DASH)
#   0x97 -> U+2014 (EM DASH)
#
# For a character with UTF-8 encoding E2 80 XX:
#   E2 -> chr(0x00E2)  (a-circumflex)
#   80 -> chr(0x20AC)  (euro sign, cp1252 byte 80)
#   XX -> chr(cp1252[XX])

_A   = chr(0x00E2)   # a-circumflex (UTF-8 byte E2 misread as Latin-1)
_EUR = chr(0x20AC)   # euro sign    (cp1252 byte 80)
_LDQ = chr(0x201C)   # left  double quote (cp1252 byte 93)
_RDQ = chr(0x201D)   # right double quote (cp1252 byte 94)
_LSQ = chr(0x2018)   # left  single quote (cp1252 byte 91)
_RSQ = chr(0x2019)   # right single quote (cp1252 byte 92)

# Characters that were corrupted by a previous bad run of this command:
#   The first bad run matched the 2-char prefix (A+EUR) and replaced it with
#   RDQ, leaving the trailing RDQ/LDQ in place, producing double-quote pairs.
_BAD_EMDASH = _RDQ + _RDQ   # artefact of bad run: should be em dash
_BAD_ENDASH = _RDQ + _LDQ   # artefact of bad run: should be en dash

REPLACEMENTS = [
    # Undo artefacts from previous bad run first
    (_BAD_EMDASH, chr(0x2014)),   # "" -> em dash  —
    (_BAD_ENDASH, chr(0x2013)),   # "" -> en dash  –
    # Correct mojibake sequences
    (_A + _EUR + _RDQ, chr(0x2014)),  # a€" -> em dash  —  (UTF-8 E2 80 94)
    (_A + _EUR + _LDQ, chr(0x2013)),  # a€" -> en dash  –  (UTF-8 E2 80 93)
    (_A + _EUR + _RSQ, chr(0x2019)),  # a€™ -> right single quote  '
    (_A + _EUR + _LSQ, chr(0x2018)),  # a€˜ -> left  single quote  '
]


def fix_text(value: str) -> str:
    if not isinstance(value, str):
        return value
    for corrupted, correct in REPLACEMENTS:
        value = value.replace(corrupted, correct)
    return value


class Command(BaseCommand):
    help = 'Fix Mojibake encoding corruption in all database text fields'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview changes without saving to database',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        total_fixed = 0

        total_fixed += self._fix_model(dry_run, 'resources', 'Resource',
            ['title', 'description', 'tags', 'law_number'])

        total_fixed += self._fix_model(dry_run, 'courses', 'Course',
            ['title', 'description', 'objectives', 'prerequisites'])

        total_fixed += self._fix_model(dry_run, 'events', 'Event',
            ['title', 'description'])

        total_fixed += self._fix_model(dry_run, 'programs', 'YouthProgram',
            ['title', 'description', 'objectives', 'target_beneficiaries'])

        action = 'Would fix' if dry_run else 'Fixed'
        self.stdout.write(
            self.style.SUCCESS(f'{action} {total_fixed} field(s) across all models.')
        )

    def _fix_model(self, dry_run, app_label, model_name, fields):
        from django.apps import apps
        try:
            Model = apps.get_model(app_label, model_name)
        except LookupError:
            return 0

        fixed_count = 0
        for obj in Model.objects.all():
            changed = False
            for field in fields:
                original = getattr(obj, field, None)
                if original is None:
                    continue
                fixed = fix_text(original)
                if fixed != original:
                    setattr(obj, field, fixed)
                    changed = True
                    fixed_count += 1
                    self.stdout.write(
                        f'  [{model_name}#{obj.pk}] {field}:\n'
                        f'    before: {ascii(original[:80])}\n'
                        f'    after:  {ascii(fixed[:80])}'
                    )
            if changed and not dry_run:
                obj.save(update_fields=fields)

        return fixed_count
