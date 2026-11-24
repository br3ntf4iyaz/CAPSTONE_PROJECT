from datetime import timedelta

from django.utils import timezone

from .documents import DOCUMENT_HELP, DOCUMENT_TYPES

CLOSING_SOON_DAYS = 14


def application_state(s):
    """open | closing_soon | closed | not_yet_open for a Scholarship."""
    today = timezone.localdate()
    if not s.accepting_applications or not s.is_published:
        return 'closed'
    if s.opens_on and today < s.opens_on:
        return 'not_yet_open'
    if s.closes_on:
        if today > s.closes_on:
            return 'closed'
        if today >= s.closes_on - timedelta(days=CLOSING_SOON_DAYS):
            return 'closing_soon'
    return 'open'


def document_requirements(s):
    out = []
    for key in s.required_documents or []:
        if key in DOCUMENT_TYPES:
            out.append({'key': key, 'label': DOCUMENT_TYPES[key], 'required': True, 'help': DOCUMENT_HELP.get(key, '')})
    for key in s.optional_documents or []:
        if key in DOCUMENT_TYPES and key not in (s.required_documents or []):
            out.append({'key': key, 'label': DOCUMENT_TYPES[key], 'required': False, 'help': DOCUMENT_HELP.get(key, '')})
    return out
