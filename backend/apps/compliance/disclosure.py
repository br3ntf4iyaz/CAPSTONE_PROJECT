"""Reporting periods, deadlines and status for the Full Public Disclosure (FPDPB) checklist.

Quarterly deadlines (fixed by the office):
    Q1 January to March      -> April 7
    Q2 April to June         -> July 7
    Q3 July to September     -> October 7
    Q4 October to December   -> January 7 of the following year

Periods are generated from the year, nothing is stored for them. A period is COMPLETED only when one of its uploads has been
verified by an administrator. Generating a period never completes it.
"""
import calendar
import datetime as dt

QUARTERS = {
    1: {'label': 'Q1 (January to March)', 'start': (1, 1), 'end': (3, 31), 'deadline': (4, 7), 'next_year': False},
    2: {'label': 'Q2 (April to June)', 'start': (4, 1), 'end': (6, 30), 'deadline': (7, 7), 'next_year': False},
    3: {'label': 'Q3 (July to September)', 'start': (7, 1), 'end': (9, 30), 'deadline': (10, 7), 'next_year': False},
    4: {'label': 'Q4 (October to December)', 'start': (10, 1), 'end': (12, 31), 'deadline': (1, 7), 'next_year': True},
}

STATUS_LABELS = {
    'completed': 'Completed',
    'under_review': 'Submitted, waiting for verification',
    'pending': 'Pending',
    'overdue': 'Overdue',
}


def quarter_deadline(year, quarter):
    q = QUARTERS[quarter]
    month, day = q['deadline']
    return dt.date(year + 1 if q['next_year'] else year, month, day)


def periods_for(requirement, year):
    """The reporting periods of one requirement in one year: four for a quarterly one, one for an annual one."""
    if requirement.frequency == 'quarterly':
        out = []
        for n, q in QUARTERS.items():
            out.append({
                'year': year, 'quarter': n, 'label': q['label'],
                'start': dt.date(year, *q['start']), 'end': dt.date(year, *q['end']),
                'deadline': quarter_deadline(year, n),
            })
        return out
    deadline = None
    if requirement.deadline_month and requirement.deadline_day:
        last = calendar.monthrange(year, requirement.deadline_month)[1]
        deadline = dt.date(year, requirement.deadline_month, min(requirement.deadline_day, last))
    return [{'year': year, 'quarter': None, 'label': f'Year {year}', 'start': dt.date(year, 1, 1),
             'end': dt.date(year, 12, 31), 'deadline': deadline}]


def period_status(submissions, deadline, today):
    """(status, late_upload). `submissions` are the uploads for this exact period.

    completed     a submission was verified by an administrator
    under_review  uploaded on or before the deadline, not verified yet
    overdue       the deadline passed and nothing was verified or uploaded on time
    pending       everything else (no upload yet, deadline not passed)
    """
    if any(s.status == 'verified' for s in submissions):
        return 'completed', False
    waiting = [s for s in submissions if s.status == 'uploaded']
    on_time = [s for s in waiting if deadline is None or s.uploaded_at.date() <= deadline]
    if on_time:
        return 'under_review', False
    if deadline is not None and today > deadline:
        return 'overdue', bool(waiting)
    return 'pending', False


def submission_data(s):
    return {
        'id': s.id, 'title': s.title, 'description': s.description, 'status': s.status,
        'uploaded_at': s.uploaded_at, 'uploaded_by': s.uploaded_by.full_name if s.uploaded_by else '',
        'verified_at': s.verified_at, 'verified_by': s.verified_by.full_name if s.verified_by else '',
        'review_note': s.review_note, 'is_public': s.is_public, 'filename': s.original_name or s.file.name.rsplit('/', 1)[-1],
    }


def build_overview(requirements, submissions_qs, year, today):
    """Everything the checklist page needs for one year, including the summary counts."""
    by_period = {}
    for s in submissions_qs.select_related('uploaded_by', 'verified_by').filter(year=year):
        by_period.setdefault((s.requirement_id, s.quarter), []).append(s)
    summary = {'total': 0, 'completed': 0, 'pending': 0, 'overdue': 0, 'under_review': 0}
    rows = []
    for req in requirements:
        periods = []
        for p in periods_for(req, year):
            subs = by_period.get((req.id, p['quarter']), [])
            status, late = period_status(subs, p['deadline'], today)
            current = (next((s for s in subs if s.status == 'verified'), None)
                       or next((s for s in subs if s.status == 'uploaded'), None) or (subs[0] if subs else None))
            summary['total'] += 1
            if status == 'completed':
                summary['completed'] += 1
            elif status == 'overdue':
                summary['overdue'] += 1
            else:
                summary['pending'] += 1  # pending plus waiting for verification
                if status == 'under_review':
                    summary['under_review'] += 1
            periods.append({
                'quarter': p['quarter'], 'label': p['label'], 'start': p['start'], 'end': p['end'], 'deadline': p['deadline'],
                'status': status, 'status_label': STATUS_LABELS[status], 'late_upload': late, 'upcoming': p['start'] > today,
                'days_to_deadline': (p['deadline'] - today).days if p['deadline'] else None,
                'current': submission_data(current) if current else None,
                'history': [submission_data(s) for s in subs],
            })
        rows.append({'id': req.id, 'title': req.title, 'description': req.description, 'frequency': req.frequency,
                     'deadline_month': req.deadline_month, 'deadline_day': req.deadline_day, 'periods': periods})
    return {'year': year, 'today': today, 'summary': summary, 'requirements': rows}
