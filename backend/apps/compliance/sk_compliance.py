"""SK Compliance Monitoring System: categories, reporting periods, deadlines and status, built on the records that already exist.

The five categories reuse the codes of sk_requirements.SKRequirement:
    cbydp, abyip, annual_budget   existing documents, referenced (never copied) through SKRequirement
    quarterly_cash                Quarterly Register of Cash in Bank (RCB) and other related financial transactions
    monthly_pr                    Monthly Itemized List (MIL) of Purchase Requests

Status of a reporting period (what the dashboards show):
    not_submitted        nothing submitted yet and the deadline has not passed
    submitted            a document was submitted and waits for LYDO
    under_verification   a LYDO reviewer has started checking it
    returned             sent back to the SK for correction
    verified             checked and accepted, not yet public
    published            verified and approved for the public FPDPB
    overdue              the deadline passed and the period is not verified or published (or the only submission came late)
A period is NEVER completed because it exists or because something was uploaded. Verified and published are the completed states.
"""
import datetime as dt

from django.utils import timezone

from apps.sk_requirements.models import SKBarangay, SKRequirement

from .disclosure import QUARTERS, quarter_deadline
from .models import SKComplianceRecord

CATEGORIES = [
    {'key': 'cbydp', 'short': 'CBYDP', 'label': 'Comprehensive Barangay Youth Development Plan (CBYDP)', 'kind': 'single', 'existing': True,
     'description': 'A three-year plan of the SK for the young people of the barangay. It sets the youth needs, goals and priorities the SK follows.'},
    {'key': 'abyip', 'short': 'ABYIP', 'label': 'Annual Barangay Youth Investment Program (ABYIP)', 'kind': 'single', 'existing': True,
     'description': "The SK's yearly list of programs, projects and activities (PPAs) with their budget, drawn from the CBYDP."},
    {'key': 'annual_budget', 'short': 'Annual Budget', 'label': 'SK Approved Annual Budget', 'kind': 'single', 'existing': True,
     'description': "The SK's approved budget for the year. It funds the programs, projects and activities in the ABYIP."},
    {'key': 'quarterly_cash', 'short': 'RCB', 'label': 'Quarterly Register of Cash in Bank (RCB) and Other Related Financial Transactions', 'kind': 'quarterly', 'existing': False,
     'description': "The Register of Cash in Bank (RCB): a record of the SK's money in the bank, with its other related financial transactions, submitted every quarter."},
    {'key': 'monthly_pr', 'short': 'MIL', 'label': 'Monthly Itemized List (MIL) of Purchase Requests', 'kind': 'monthly', 'existing': False,
     'description': "The Monthly Itemized List (MIL): the SK's purchase requests for the month. If there were none, the SK declares NONE FOR THE PERIOD."},
]
CATEGORY_BY_KEY = {c['key']: c for c in CATEGORIES}
EXISTING_CATEGORIES = [c['key'] for c in CATEGORIES if c['existing']]

MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

STATUS_LABELS = {
    'not_submitted': 'Not Yet Submitted',
    'draft': 'Draft',
    'submitted': 'Submitted',
    'under_verification': 'Under Verification',
    'returned': 'Returned for Correction',
    'verified': 'Verified',
    'published': 'Published',
    'overdue': 'Overdue',
}
COMPLETED = ('verified', 'published')


# ── periods ───────────────────────────────────────────────────────────────────

def month_deadline(year, month):
    """The 7th of the FOLLOWING month (December is due January 7 of the next year)."""
    return dt.date(year + 1, 1, 7) if month == 12 else dt.date(year, month + 1, 7)


def slots_for(category, year):
    """The reporting periods a barangay owes in one year for one category."""
    kind = CATEGORY_BY_KEY[category]['kind']
    if kind == 'quarterly':
        return [{'category': category, 'quarter': n, 'month': None, 'label': QUARTERS[n]['label'],
                 'start': dt.date(year, *QUARTERS[n]['start']), 'end': dt.date(year, *QUARTERS[n]['end']),
                 'deadline': None} for n in (1, 2, 3, 4)]  # official deadlines are set by LYDO (SKDeadline), never assumed
    if kind == 'monthly':
        out = []
        for m in range(1, 13):
            last = (dt.date(year + (m == 12), (m % 12) + 1, 1) - dt.timedelta(days=1))
            out.append({'category': category, 'quarter': None, 'month': m, 'label': f'{MONTH_NAMES[m - 1]} {year}',
                        'start': dt.date(year, m, 1), 'end': last, 'deadline': None})
        return out
    label = {'cbydp': f'CBYDP in force in {year}', 'abyip': f'ABYIP {year}', 'annual_budget': f'Annual Budget {year}'}[category]
    return [{'category': category, 'quarter': None, 'month': None, 'label': label,
             'start': dt.date(year, 1, 1), 'end': dt.date(year, 12, 31), 'deadline': None}]  # deadline: the SK requirement's due date


def matches(record, slot, year):
    if record.category != slot['category']:
        return False
    if slot['category'] == 'cbydp':
        return record.year <= year <= (record.period_end_year or record.year + 2)
    if record.year != year:
        return False
    return record.quarter == slot['quarter'] and record.month == slot['month']


def slot_status(record, deadline, today):
    """(status, late). `record` is the newest submission for the period or None."""
    if record is not None:
        if record.status in COMPLETED:
            return record.status, False
        passed = deadline is not None and today > deadline
        if record.status == 'returned':
            return ('overdue' if passed else 'returned'), False
        late = deadline is not None and record.submitted_at is not None and timezone.localtime(record.submitted_at).date() > deadline
        if passed and late:
            return 'overdue', True
        return record.status, False
    if deadline is not None and today > deadline:
        return 'overdue', False
    return 'not_submitted', False


# ── existing records: index them, never copy them ─────────────────────────────

def ensure_indexed():
    """Give every existing SKRequirement document (CBYDP, ABYIP, Annual Budget) that has a file a compliance record that REFERENCES it,
    so it can be verified and published. Idempotent: a requirement that already has a record is left alone."""
    todo = (SKRequirement.objects.filter(requirement_type__in=EXISTING_CATEGORIES, compliance_records__isnull=True)
            .exclude(file='').exclude(file__isnull=True).select_related('barangay'))
    made = 0
    for req in todo:
        when = req.submitted_at or req.updated_at or timezone.now()
        year = timezone.localtime(when).year
        SKComplianceRecord.objects.create(
            barangay=req.barangay, category=req.requirement_type, year=year,
            period_end_year=year + 2 if req.requirement_type == 'cbydp' else None,
            requirement=req, source_file_name=req.file.name, title=req.get_requirement_type_display(),
            status='submitted', submitted_at=when)
        made += 1
    return made


def record_requirement_submission(req, user=None):
    """Called by the EXISTING upload paths of SK Requirements right after a file is stored: index that exact file so LYDO can verify and
    publish it. The file itself is not copied. Calling it twice for the same stored file does nothing."""
    if req.requirement_type not in EXISTING_CATEGORIES or not req.file:
        return None
    if SKComplianceRecord.objects.filter(requirement=req, source_file_name=req.file.name).exists():
        return None
    when = req.submitted_at or timezone.now()
    year = timezone.localtime(when).year
    rec = SKComplianceRecord.objects.create(
        barangay=req.barangay, category=req.requirement_type, year=year,
        period_end_year=year + 2 if req.requirement_type == 'cbydp' else None, requirement=req, source_file_name=req.file.name,
        title=req.get_requirement_type_display(), status='submitted', submitted_by=user if getattr(user, 'pk', None) else None, submitted_at=when)
    notify(admin_users(), 'New SK compliance submission',
           f'{req.barangay.barangay_name} submitted {describe(rec)}. It is waiting for verification.', '/admin/sk-compliance')
    return rec


def requirement_deadlines():
    """{(barangay_id, category): due_date} for the existing requirement rows that have a due date."""
    return {(r.barangay_id, r.requirement_type): r.due_date
            for r in SKRequirement.objects.filter(requirement_type__in=EXISTING_CATEGORIES).exclude(due_date__isnull=True)}


# ── the monitoring table ──────────────────────────────────────────────────────

def build_monitoring(barangays, year, today, category=None, status=None, publication=None, quarter=None, month=None):
    """Dashboard numbers and the barangay x category table, from the real records. `barangays` is a queryset or list of SKBarangay."""
    barangays = list(barangays)
    ids = [b.id for b in barangays]
    categories = [c for c in CATEGORIES if not category or c['key'] == category]
    records = {}
    for r in SKComplianceRecord.objects.filter(barangay_id__in=ids).select_related('submitted_by').order_by('submitted_at', 'id'):
        records.setdefault((r.barangay_id, r.category), []).append(r)
    from apps.sk_requirements.deadlines import deadline_for, load_deadlines
    dl = load_deadlines()

    summary = {'total': 0, 'completed': 0, 'pending': 0, 'overdue': 0, 'for_verification': 0, 'returned': 0, 'verified': 0, 'published': 0}
    rows = []
    for b in barangays:
        cells = {}
        totals = {'total': 0, 'completed': 0, 'overdue': 0}
        for cat in categories:
            periods = []
            for slot in slots_for(cat['key'], year):
                if quarter and slot['quarter'] != quarter:
                    continue
                if month and slot['month'] != month:
                    continue
                if (quarter or month) and cat['kind'] == 'single':
                    continue
                recs = [r for r in records.get((b.id, cat['key']), []) if matches(r, slot, year)]
                current = recs[-1] if recs else None
                deadline = deadline_for(dl, b.id, cat['key'], year, slot['quarter'], slot['month'])  # None unless LYDO configured one
                st, late = slot_status(current, deadline, today)
                workflow = current.status if current else None
                if status and st != status:
                    continue
                if publication == 'published' and workflow != 'published':
                    continue
                if publication == 'unpublished' and workflow == 'published':
                    continue
                periods.append({'label': slot['label'], 'quarter': slot['quarter'], 'month': slot['month'], 'deadline': deadline,
                                'status': st, 'status_label': STATUS_LABELS[st], 'late': late, 'workflow': workflow,
                                'record_id': current.id if current else None, 'history': len(recs)})
                summary['total'] += 1
                totals['total'] += 1
                if st in COMPLETED:
                    summary['completed'] += 1
                    totals['completed'] += 1
                elif st == 'overdue':
                    summary['overdue'] += 1
                    totals['overdue'] += 1
                else:
                    summary['pending'] += 1
                if workflow in ('submitted', 'under_verification'):
                    summary['for_verification'] += 1
                elif workflow == 'returned':
                    summary['returned'] += 1
                elif workflow == 'verified':
                    summary['verified'] += 1
                elif workflow == 'published':
                    summary['published'] += 1
            cells[cat['key']] = {'periods': periods, 'kind': cat['kind'],
                                 'completed': sum(1 for p in periods if p['status'] in COMPLETED),
                                 'overdue': sum(1 for p in periods if p['status'] == 'overdue'), 'total': len(periods)}
        rows.append({'barangay_id': b.id, 'barangay': b.barangay_name, 'cells': cells, 'totals': totals})
    pct = round(100 * summary['completed'] / summary['total']) if summary['total'] else 0
    return {'year': year, 'today': today, 'summary': summary, 'percent': pct, 'rows': rows,
            'categories': [{'key': c['key'], 'short': c['short'], 'label': c['label'], 'kind': c['kind'], 'description': c['description']} for c in CATEGORIES]}


def slot_details(barangay, category, year, today):
    """Everything about one barangay's periods in one category: each period with its newest record and its full history."""
    from apps.sk_requirements.deadlines import deadline_for, load_deadlines
    dl = load_deadlines()
    recs = list(SKComplianceRecord.objects.filter(barangay=barangay, category=category).select_related('submitted_by', 'reviewed_by')
                .order_by('submitted_at', 'id'))
    out = []
    for slot in slots_for(category, year):
        mine = [r for r in recs if matches(r, slot, year)]
        current = mine[-1] if mine else None
        deadline = deadline_for(dl, barangay.id, category, year, slot['quarter'], slot['month'])
        st, late = slot_status(current, deadline, today)
        out.append({**slot, 'deadline': deadline, 'status': st, 'status_label': STATUS_LABELS[st], 'late': late,
                    'current': current, 'history': list(reversed(mine))})
    return out


# ── people ────────────────────────────────────────────────────────────────────

def is_admin(user):
    return getattr(user, 'is_authenticated', False) and getattr(user, 'role', '') in ('lgu_admin', 'super_admin')


def own_barangay(user):
    """The SK council of a signed-in SK official (from their profile), or None."""
    from apps.sk_requirements.views import _own_barangay
    return _own_barangay(user) if getattr(user, 'is_authenticated', False) else None


def is_verified(user):
    try:
        return user.id_verification.status == 'approved'
    except Exception:
        return False


def sk_users_of(barangay):
    from django.contrib.auth import get_user_model
    return get_user_model().objects.filter(role='youth', youth_type='sk', is_active=True,
                                           profile__barangay__iexact=barangay.barangay_name)


def admin_users():
    from django.contrib.auth import get_user_model
    return get_user_model().objects.filter(role__in=('lgu_admin', 'super_admin'), is_active=True)


def notify(users, title, message, link, within_days=1):
    """Send an in-app notification through the existing system. The same text is not repeated to the same person within `within_days`."""
    from apps.notifications.models import Notification
    from apps.notifications.views import create_notification
    since = timezone.now() - dt.timedelta(days=within_days)
    sent = 0
    for u in users:
        if Notification.objects.filter(user=u, title=title, message=message, created_at__gte=since).exists():
            continue
        create_notification(u, title, message, 'system', link)
        sent += 1
    return sent


def describe(record):
    cat = CATEGORY_BY_KEY[record.category]['short']
    if record.quarter:
        return f'{cat} Q{record.quarter} {record.year}'
    if record.month:
        return f'{cat} {MONTH_NAMES[record.month - 1]} {record.year}'
    return f'{cat} {record.year}'
