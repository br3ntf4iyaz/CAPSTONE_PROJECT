"""
What gets fingerprinted for each kind of record. A payload must contain every field
whose silent change we want to detect, and nothing that changes legitimately (like
updated_at). Files are represented by their SHA-256.
"""
from datetime import date, timedelta

from django.db.models.functions import TruncDate
from django.utils import timezone

from .service import Verifier, canonical_hash, file_sha256, record

REVIEW_LOG = 'review_log'
SK_REQUIREMENT = 'sk_requirement'
ID_DECISION = 'id_decision'
AUDIT_DAY = 'audit_day'
COURSE_CERT = 'course_cert'
RECOGNITION_CERT = 'recognition_cert'

ID_FINAL = ('approved', 'rejected')


def _iso(v):
    return v.isoformat() if v else None


def review_log(log) -> dict:
    return {
        'submission_id': log.submission_id, 'action': log.action, 'notes': log.notes,
        'actor_id': log.actor_id, 'created_at': _iso(log.created_at),
    }


def sk_requirement(req) -> dict:
    return {
        'barangay_id': req.barangay_id, 'requirement_type': req.requirement_type,
        'status': req.status, 'submitted_at': _iso(req.submitted_at),
        'file_sha256': file_sha256(req.file),
    }


def id_decision(v) -> dict:
    return {
        'user_id': v.user_id, 'id_type': v.id_type, 'status': v.status,
        'ai_verdict': v.ai_verdict, 'ai_confidence': v.ai_confidence,
        'reviewed_by_id': v.reviewed_by_id, 'reviewed_at': _iso(v.reviewed_at),
        'admin_notes': v.admin_notes, 'image_sha256': file_sha256(v.id_image),
    }


def course_cert(cert) -> dict:
    return {
        'certificate_number': cert.certificate_number,
        'user_id': cert.enrollment.user_id, 'course_id': cert.enrollment.course_id,
        'issued_at': _iso(cert.issued_at), 'file_sha256': file_sha256(cert.file),
    }


def recognition_cert(cert) -> dict:
    return {
        'certificate_number': cert.certificate_number,
        'user_id': cert.user_id, 'title': cert.title, 'issued_by': cert.issued_by,
        'issued_at': _iso(cert.issued_at), 'expiry_date': _iso(cert.expiry_date),
        'file_sha256': file_sha256(cert.file),
    }


def audit_day(day: date) -> dict:
    from apps.accounts.models import AuditLog
    rows = AuditLog.objects.filter(created_at__date=day).order_by('id')
    row_hashes = [
        canonical_hash({
            'id': r.id, 'user_id': r.user_id, 'action': r.action, 'model_name': r.model_name,
            'object_id': r.object_id, 'details': r.details, 'ip': r.ip_address,
            'created_at': _iso(r.created_at),
        })
        for r in rows
    ]
    return {'day': day.isoformat(), 'count': len(row_hashes), 'rows': canonical_hash({'h': row_hashes})}


def audit_days_with_entries():
    """Completed days (before today) that have audit entries."""
    from apps.accounts.models import AuditLog
    today = timezone.localdate()
    # order_by() clears AuditLog's default ordering; otherwise DISTINCT applies per entry, not per day.
    days = (
        AuditLog.objects.order_by().annotate(d=TruncDate('created_at'))
        .values_list('d', flat=True).distinct()
    )
    return sorted({d for d in days if d and d < today})


def anchor_audit_days() -> int:
    """
    Anchor every completed day that has no anchor yet. A day that already has one is
    never re-anchored: that is what lets us notice if its entries are changed later.
    """
    from .models import Anchor
    done = {a.ref for a in Anchor.objects.filter(kind=AUDIT_DAY)}
    n = 0
    for d in audit_days_with_entries():
        if d.isoformat() not in done:
            record(AUDIT_DAY, d.isoformat(), audit_day(d))
            n += 1
    return n


def recent_audit_days(limit: int = 30):
    days = audit_days_with_entries()[-limit:]
    v = Verifier()
    out = []
    for d in reversed(days):
        p = audit_day(d)
        out.append({'day': d.isoformat(), 'count': p['count'], **v.check(AUDIT_DAY, d.isoformat(), p)})
    return out
