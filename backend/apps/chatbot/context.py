"""Builds a short, live snapshot of LYDOP data for the chatbot's system prompt.

Only public, published information is included (no personal data), so the
assistant can answer "what events/scholarships/jobs are available?" with real
records instead of guessing.
"""
import logging

from django.utils import timezone

logger = logging.getLogger(__name__)

MAX_ITEMS = 5


def _clip(text, n=160):
    text = (text or '').strip().replace('\n', ' ')
    return text if len(text) <= n else text[: n - 1] + '…'


def _events():
    from apps.events.models import Event

    qs = Event.objects.filter(
        is_published=True, is_active=True, end_datetime__gte=timezone.now()
    ).order_by('start_datetime')[:MAX_ITEMS]
    lines = []
    for e in qs:
        when = timezone.localtime(e.start_datetime).strftime('%b %d, %Y %I:%M %p')
        where = e.location or ('Online' if e.meeting_link else 'TBA')
        lines.append(f'- {e.title} ({e.get_event_type_display()}), {when}, {where}')
    return lines


def _scholarships():
    from apps.resources.models import Scholarship

    today = timezone.localdate().isoformat()
    lines = []
    for s in Scholarship.objects.filter(is_published=True).order_by('-is_featured', '-id'):
        d = (s.deadline or '').strip()
        # Deadlines are free text; skip ISO dates (YYYY-MM-DD) that already passed.
        if len(d) == 10 and d[4] == '-' and d[7] == '-' and d < today:
            continue
        lines.append(f'- {s.title} by {s.provider}: {s.amount}; deadline: {d or "TBD"}')
        if len(lines) >= MAX_ITEMS:
            break
    return lines


def _jobs():
    from apps.jobs.models import JobOpportunity

    today = timezone.localdate()
    qs = JobOpportunity.objects.filter(is_active=True).order_by(
        '-is_featured', '-created_at'
    )
    lines = []
    for j in qs:
        if j.application_deadline and j.application_deadline < today:
            continue
        lines.append(
            f'- {j.title} at {j.company_or_org} ({j.get_job_type_display()}, {j.location})'
        )
        if len(lines) >= MAX_ITEMS:
            break
    return lines


def _faqs():
    from apps.support.models import FAQ

    return [
        f'- Q: {_clip(f.question, 120)} A: {_clip(f.answer, 220)}'
        for f in FAQ.objects.filter(is_published=True)[:MAX_ITEMS]
    ]


def build_context():
    """Return a text block of live portal data; empty string if nothing found."""
    sections = []
    for title, fn in (
        ('Upcoming events', _events),
        ('Scholarships', _scholarships),
        ('Open jobs', _jobs),
        ('Frequently asked questions', _faqs),
    ):
        try:
            lines = fn()
        except Exception:  # noqa: BLE001 - never break the chat over context
            logger.exception('chatbot context section failed: %s', title)
            continue
        if lines:
            sections.append(f'{title}:\n' + '\n'.join(lines))
    return '\n\n'.join(sections)
