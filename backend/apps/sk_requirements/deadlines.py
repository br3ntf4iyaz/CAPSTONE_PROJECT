"""Official deadlines. A requirement is overdue ONLY when LYDO configured a deadline for it and that date has passed."""
from .models import SKDeadline


def load_deadlines():
    """All active official deadlines, loaded once per request."""
    out = []
    for d in SKDeadline.objects.filter(is_active=True).prefetch_related('barangays'):
        out.append({'code': d.code, 'year': d.year, 'quarter': d.quarter, 'month': d.month, 'deadline': d.deadline,
                    'all': d.applies_to_all, 'ids': {b.id for b in d.barangays.all()}})
    return out


def deadline_for(cache, barangay_id, code, year, quarter=None, month=None):
    """The configured deadline date for this barangay, requirement and period, or None. A deadline set for chosen barangays wins over a general one."""
    found = None
    for d in cache:
        if d['code'] == code and d['year'] == year and d['quarter'] == quarter and d['month'] == month and (d['all'] or barangay_id in d['ids']):
            if found is None or not d['all']:
                found = d['deadline']
    return found
