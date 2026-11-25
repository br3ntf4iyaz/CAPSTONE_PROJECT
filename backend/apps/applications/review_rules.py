"""The rules an administrator must satisfy before approving, in one place (used by the API and shown in the review screen).

Four different things are kept apart on purpose: a requirement was UPLOADED, it was OPENED by the administrator,
the AI screened it, and a person CONFIRMED it. Only the last, plus the rest of these rules, allows an approval.
"""
from datetime import timedelta

from django.utils import timezone

from .ai_screening import DOCS, INVALID, LABELS, MISSING, STALE_AFTER

CHECKS = {
    'id': 'I personally reviewed the applicant\'s ID front and back.',
    'selfie': 'I personally reviewed the submitted selfie.',
    'resume': 'I reviewed the resume and confirmed that it contains appropriate resume information.',
    'ai_findings': 'I reviewed the AI verification findings.',
}
CHECK_NEEDS = {'id': ('id_front', 'id_back'), 'selfie': ('selfie',), 'resume': ('resume',), 'ai_findings': ()}
REJECT_KEYS = set(DOCS) | {'other'}


def submitted(app, key):
    return bool(getattr(app, DOCS[key]))


def ai_in_progress(app):
    if app.ai_status not in ('pending', 'processing'):
        return False
    since = app.ai_started_at or app.submitted_at
    return timezone.now() - since < timedelta(seconds=STALE_AFTER)


def flagged(app):
    """Requirements the AI found invalid or missing (and that no one has explained away)."""
    docs = (app.ai_results or {}).get('documents', {})
    return [k for k in DOCS if (docs.get(k) or {}).get('status') in (INVALID, MISSING)]


def approval_blockers(app):
    """Plain sentences saying what still stops an approval. Empty list = the administrator may approve."""
    out = []
    for key in DOCS:
        if not submitted(app, key):
            out.append(f'{LABELS[key]} was not submitted.')
    for key in DOCS:
        if submitted(app, key) and key not in (app.opened_docs or {}):
            out.append(f'Open the {LABELS[key]} first.')
    for name, text in CHECKS.items():
        if not (app.manual_checks or {}).get(name):
            out.append(f'Tick: {text}')
    if ai_in_progress(app):
        out.append('The AI screening is still running. Wait for it, then review its findings.')
    bad = flagged(app)
    if bad and len((app.ai_override_note or '').strip()) < 10:
        out.append(f'The AI flagged {", ".join(LABELS[k] for k in bad)} as invalid or missing. Fix that, or write why you accept it anyway.')
    return out


def rejection_message(items, note):
    """What the applicant reads. Built from the requirements chosen and the administrator's own words."""
    parts = []
    names = [LABELS.get(i, '') for i in items if i in LABELS]
    if names:
        if len(names) == 1:
            parts.append(f'Your application was not accepted because the uploaded file for the {names[0]} requirement is invalid or missing. Please submit the correct document.')
        else:
            parts.append(f'Your application was not accepted because these requirements are invalid or missing: {", ".join(names)}. Please submit the correct documents.')
    if note.strip():
        parts.append(note.strip())
    return ' '.join(parts)
