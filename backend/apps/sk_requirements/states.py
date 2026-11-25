"""The honest state of every SK requirement of a barangay, in ONE place.

A document counts as completed ONLY when LYDO verified it. An upload is "waiting for LYDO", never "done".

    not_submitted  nothing real has been submitted (a row marked "submitted" with no file and no LYDO review is NOT a submission)
    submitted      handed in, waiting for LYDO
    returned       LYDO sent it back with remarks; the SK corrects it and submits again
    verified       LYDO verified it  -> the only completed state
    overdue        the deadline passed and it is not verified (or waiting)

Ten requirements, two sources:
  CBYDP, ABYIP, Annual Budget, RCB, MIL  -> the SK Compliance Monitoring System (apps.compliance): its records and review workflow decide
  the other five (Annex H, Policies, Minutes, KK Assembly, Linggo ng Kabataan) -> the SKRequirement row: SK upload + LYDO review
"""
from django.utils import timezone

from .models import REQUIREMENT_CHOICES, SKRequirement

MONITORED = ('cbydp', 'abyip', 'annual_budget', 'quarterly_cash', 'monthly_pr')
LABELS = dict(REQUIREMENT_CHOICES)

DONE = 'verified'
IN_REVIEW = ('submitted', 'under_verification')


def other_state(req, today):
    """State of one of the five documents LYDO reviews directly on the SKRequirement row."""
    if req is None:
        return 'not_submitted'
    reviewed = req.reviewed_at is not None
    if req.status == 'submitted':
        if reviewed:
            return DONE  # LYDO checked it (or recorded it)
        if req.file:
            return 'submitted'  # a real upload, waiting for LYDO
        # "submitted" with no file and no review: placeholder data, not a submission. Fall through to the deadline.
    elif req.status == 'pending' and reviewed and req.review_remarks:
        return 'returned'
    if req.status == 'overdue' or (req.due_date and req.due_date < today):
        return 'overdue'
    return 'not_submitted'


def _monitored_state(cell):
    periods = cell['periods']
    if not periods:
        return 'not_submitted', ''
    sts = [p['status'] for p in periods]
    if cell['kind'] == 'single':
        st = sts[0]
        return ({'verified': DONE, 'published': DONE, 'submitted': 'submitted', 'under_verification': 'submitted',
                 'returned': 'returned', 'overdue': 'overdue'}.get(st, 'not_submitted')), ''
    done = sum(1 for s in sts if s in ('verified', 'published'))
    detail = f'{done} of {len(sts)} verified'
    if done == len(sts):
        return DONE, detail
    if any(s == 'overdue' for s in sts):
        return 'overdue', detail
    if any(s in IN_REVIEW for s in sts):
        return 'submitted', detail
    if any(s == 'returned' for s in sts):
        return 'returned', detail
    return 'not_submitted', detail


def directory_states(barangays, today=None):
    """{barangay_id: [row, ...]} with one row per requirement, in the standard order. Few queries, whatever the number of barangays."""
    from apps.compliance import sk_compliance as skc
    barangays = list(barangays)
    today = today or timezone.localdate()
    ids = [b.id for b in barangays]
    reqs = {}
    for r in SKRequirement.objects.filter(barangay_id__in=ids):
        reqs[(r.barangay_id, r.requirement_type)] = r
    from apps.compliance.models import SKComplianceRecord
    published = {}
    for rec in SKComplianceRecord.objects.filter(requirement__barangay_id__in=ids, status='published').order_by('published_at', 'id'):
        published[rec.requirement_id] = rec.pk  # the newest published file of that requirement
    monitoring = skc.build_monitoring(barangays, today.year, today)
    monitored = {row['barangay_id']: row['cells'] for row in monitoring['rows']}
    out = {}
    for b in barangays:
        rows = []
        for code, label in REQUIREMENT_CHOICES:
            req = reqs.get((b.id, code))
            detail = ''
            if code in MONITORED:
                cell = monitored.get(b.id, {}).get(code)
                state, detail = _monitored_state(cell) if cell else ('not_submitted', '')
            else:
                state = other_state(req, today)
            rows.append({
                'id': req.id if req else None, 'key': code, 'label': label, 'status': state, 'detail': detail,
                'submitted_at': req.submitted_at if req and state in ('submitted', DONE) and req.file else None,
                'remarks': req.review_remarks if req and state in ('returned', DONE) else '',
                'monitored': code in MONITORED,
                'due_date': req.due_date if req else None,
                'published_record_id': published.get(req.id) if req else None,
            })
        out[b.id] = rows
    return out


def counts_of(rows):
    done = sum(1 for r in rows if r['status'] == DONE)
    overdue = sum(1 for r in rows if r['status'] == 'overdue')
    return {'total': len(rows), 'submitted': done, 'overdue': overdue, 'pending': len(rows) - done - overdue}
