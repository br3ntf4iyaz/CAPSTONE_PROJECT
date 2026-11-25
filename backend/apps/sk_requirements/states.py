"""The honest state of every SK requirement of a barangay, in ONE place.

A document counts as completed ONLY when LYDO verified it. An upload is "waiting for LYDO", never "done".

    not_submitted  nothing real has been submitted (a row marked "submitted" with no file and no LYDO review is NOT a submission)
    draft          the SK started a submission but has not sent it; it does not count
    submitted      handed in, waiting for LYDO
    returned       LYDO sent it back with remarks; the SK corrects it and submits again
    verified       LYDO verified it  -> the only completed state
    overdue        an OFFICIAL deadline (set by LYDO) passed and it is not verified or waiting. Without a configured deadline: never overdue.

Ten requirements, configured centrally (SKRequirementConfig), two sources of truth:
  CBYDP, ABYIP, Annual Budget, RCB, MIL  -> the SK Compliance Monitoring System (apps.compliance): its records and review workflow decide
  the other five (Annex H, Policies, Minutes, KK Assembly, Linggo ng Kabataan) -> the SKRequirement row: SK upload + LYDO review
"""
from django.utils import timezone

from .defaults import DEFAULT_CONFIGS
from .deadlines import deadline_for, load_deadlines
from .models import REQUIREMENT_CHOICES, SKRequirement, SKRequirementConfig

MONITORED = ('cbydp', 'abyip', 'annual_budget', 'quarterly_cash', 'monthly_pr')
LABELS = dict(REQUIREMENT_CHOICES)

DONE = 'verified'
IN_REVIEW = ('submitted', 'under_verification')


def ensure_configs():
    """The ten shared definitions exist (idempotent; never overwrites what LYDO edited)."""
    have = set(SKRequirementConfig.objects.values_list('code', flat=True))
    for order, (code, description, instructions) in enumerate(DEFAULT_CONFIGS, start=1):
        if code not in have:
            SKRequirementConfig.objects.create(code=code, description=description, instructions=instructions, order=order)


def configs_by_barangay(barangays):
    """{barangay_id: [config, ...]}: the ACTIVE requirements that apply to each barangay, in order."""
    ensure_configs()
    configs = list(SKRequirementConfig.objects.filter(is_active=True).prefetch_related('barangays'))
    out = {}
    for b in barangays:
        out[b.id] = [c for c in configs if c.applies_to_all or any(x.id == b.id for x in c.barangays.all())]
    return out


def other_state(req, today, deadline=None):
    """State of one of the five documents LYDO reviews directly on the SKRequirement row. `deadline` is the OFFICIAL one, or None."""
    passed = deadline is not None and today > deadline
    if req is None:
        return 'overdue' if passed else 'not_submitted'
    reviewed = req.reviewed_at is not None
    if req.status == 'submitted':
        if reviewed:
            return DONE  # LYDO checked it (or recorded it)
        if req.file:
            return 'submitted'  # a real upload, waiting for LYDO
        # "submitted" with no file and no review: placeholder data, not a submission. Fall through.
    elif req.status == 'pending' and reviewed and req.review_remarks:
        return 'returned'
    elif req.status == 'draft':
        return 'overdue' if passed else 'draft'
    return 'overdue' if passed else 'not_submitted'


def _monitored_state(cell):
    periods = cell['periods']
    if not periods:
        return 'not_submitted', '', False
    sts = [p['status'] for p in periods]
    published = all(p.get('workflow') == 'published' for p in periods)
    if cell['kind'] == 'single':
        st = sts[0]
        return ({'verified': DONE, 'published': DONE, 'submitted': 'submitted', 'under_verification': 'submitted',
                 'returned': 'returned', 'overdue': 'overdue'}.get(st, 'not_submitted')), '', published
    done = sum(1 for s in sts if s in ('verified', 'published'))
    detail = f'{done} of {len(sts)} verified'
    if done == len(sts):
        return DONE, detail, published
    if any(s == 'overdue' for s in sts):
        return 'overdue', detail, False
    if any(s in IN_REVIEW for s in sts):
        return 'submitted', detail, False
    if any(s == 'returned' for s in sts):
        return 'returned', detail, False
    return 'not_submitted', detail, False


def directory_states(barangays, today=None):
    """{barangay_id: [row, ...]}: one row per requirement that APPLIES to that barangay, in order. Few queries, whatever the number of barangays."""
    from apps.compliance import sk_compliance as skc
    from apps.compliance.models import SKComplianceRecord
    barangays = list(barangays)
    today = today or timezone.localdate()
    ids = [b.id for b in barangays]
    reqs = {(r.barangay_id, r.requirement_type): r for r in SKRequirement.objects.filter(barangay_id__in=ids)}
    published = {}
    for rec in SKComplianceRecord.objects.filter(requirement__barangay_id__in=ids, status='published').order_by('published_at', 'id'):
        published[rec.requirement_id] = rec.pk  # the newest published file of that requirement
    monitoring = skc.build_monitoring(barangays, today.year, today)
    monitored = {row['barangay_id']: row['cells'] for row in monitoring['rows']}
    dl = load_deadlines()
    cfgs = configs_by_barangay(barangays)
    out = {}
    for b in barangays:
        rows = []
        for cfg in cfgs[b.id]:
            code = cfg.code
            req = reqs.get((b.id, code))
            deadline = deadline_for(dl, b.id, code, today.year)
            detail, is_published = '', False
            if code in MONITORED:
                cell = monitored.get(b.id, {}).get(code)
                state, detail, is_published = _monitored_state(cell) if cell else ('not_submitted', '', False)
                if state in ('not_submitted',) and req is not None and req.status == 'draft':
                    state = 'draft'  # the SK saved a draft of a single-document requirement
            else:
                state = other_state(req, today, deadline)
            rows.append({
                'id': req.id if req else None, 'key': code, 'label': LABELS.get(code, code), 'status': state, 'detail': detail,
                'description': cfg.description, 'instructions': cfg.instructions,
                'submitted_at': req.submitted_at if req and state in ('submitted', DONE) and req.file else None,
                'remarks': req.review_remarks if req and state in ('returned', DONE) else '',
                'monitored': code in MONITORED,
                'due_date': deadline,  # only an OFFICIAL deadline set by LYDO; None means none is configured
                'period_year': req.period_year if req else None, 'period_label': req.period_label if req else '',
                'published': is_published,
                'published_record_id': published.get(req.id) if req else None,
            })
        out[b.id] = rows
    return out


def counts_of(rows):
    """Per-barangay numbers for the directory: only verified counts as done."""
    done = sum(1 for r in rows if r['status'] == DONE)
    overdue = sum(1 for r in rows if r['status'] == 'overdue')
    return {'total': len(rows), 'submitted': done, 'overdue': overdue, 'pending': len(rows) - done - overdue}


def unit_summary(states, only_status=None, only_category=None):
    """The LYDO dashboard numbers, counted per requirement per barangay (10 x 33 = 330 when all ten apply to every barangay)."""
    s = {'total': 0, 'completed': 0, 'pending': 0, 'overdue': 0, 'for_verification': 0, 'returned': 0, 'verified': 0, 'published': 0, 'not_submitted': 0}
    for rows in states.values():
        for r in rows:
            if only_category and r['key'] != only_category:
                continue
            if only_status and r['status'] != only_status and not (only_status == 'published' and r['published']):
                continue
            s['total'] += 1
            st = r['status']
            if st == DONE:
                s['completed'] += 1
                s['published' if r['published'] else 'verified'] += 1
            elif st == 'overdue':
                s['overdue'] += 1
            elif st == 'submitted':
                s['for_verification'] += 1
            elif st == 'returned':
                s['returned'] += 1
            elif st == 'draft':
                s['pending'] += 1  # a draft: started, not submitted
            else:
                s['not_submitted'] += 1
    return s
