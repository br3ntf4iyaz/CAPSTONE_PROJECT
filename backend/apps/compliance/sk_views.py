import os

from django.core.files.storage import default_storage
from django.db import transaction
from django.http import FileResponse, Http404
from django.utils import timezone
from rest_framework import status as http
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import AuditLog
from apps.accounts.storage import private_storage
from apps.accounts.uploads import OFFICE_EXTS, check_upload
from apps.sk_requirements.models import SKBarangay

from . import sk_compliance as sk
from .models import SKComplianceRecord

MAX_UPLOAD = 15 * 1024 * 1024
FIRST_YEAR = 2020
CATEGORY_KEYS = [c['key'] for c in sk.CATEGORIES]

_INLINE = {'.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg'}


def _year(request):
    today = timezone.localdate()
    try:
        y = int(request.query_params.get('year', today.year))
    except (TypeError, ValueError):
        y = today.year
    return min(max(y, FIRST_YEAR), today.year + 1)


def _int(request, name, lo, hi):
    try:
        v = int(request.query_params.get(name, ''))
    except (TypeError, ValueError):
        return None
    return v if lo <= v <= hi else None


def _audit(request, action, record, **details):
    AuditLog.objects.create(user=request.user, action=action, model_name='SKComplianceRecord', object_id=record.pk,
                            details={'barangay': record.barangay.barangay_name, 'category': record.category, 'year': record.year,
                                     'quarter': record.quarter, 'month': record.month, **details})


def _forbidden(msg='This page is for SK officials and LYDO staff.'):
    return Response({'detail': msg}, status=http.HTTP_403_FORBIDDEN)


def record_data(r, internal=True):
    """internal=True is for LYDO and for the SK of that barangay (they may read the reviewer's remarks). Never used for the public."""
    d = {
        'id': r.id, 'category': r.category, 'year': r.year, 'period_end_year': r.period_end_year, 'quarter': r.quarter, 'month': r.month,
        'status': r.status, 'status_label': sk.STATUS_LABELS[r.status], 'is_none_declaration': r.is_none_declaration,
        'title': r.title, 'description': r.description, 'total_amount': str(r.total_amount) if r.total_amount is not None else None,
        'submitted_at': r.submitted_at, 'submitted_by': r.submitted_by.full_name if r.submitted_by else '',
        'has_file': bool(r.file or r.source_file_name), 'filename': r.original_name or os.path.basename(r.file.name if r.file else r.source_file_name),
        'via_existing_requirement': r.requirement_id is not None, 'published_at': r.published_at,
    }
    if internal:
        d.update({'reviewed_at': r.reviewed_at, 'reviewed_by': r.reviewed_by.full_name if r.reviewed_by else '', 'review_remarks': r.review_remarks})
    return d


def _scope(request, barangay_param=None):
    """(barangays queryset, me) for the signed-in person, or (None, error response). LYDO sees all; an SK official only their own."""
    user = request.user
    if sk.is_admin(user):
        qs = SKBarangay.objects.filter(is_active=True)
        if barangay_param:
            qs = qs.filter(pk=barangay_param)
        return qs, {'role': 'admin', 'barangay': None, 'can_submit': True, 'needs_verification': False}
    own = sk.own_barangay(user)
    if own is None:
        return None, _forbidden('This page is for SK officials whose profile has a barangay with an SK council, and for LYDO staff.')
    if barangay_param and barangay_param != own.pk:
        return None, _forbidden('You can only see the compliance records of your own barangay.')
    verified = sk.is_verified(user)
    return SKBarangay.objects.filter(pk=own.pk), {'role': 'sk', 'barangay': {'id': own.id, 'name': own.barangay_name},
                                                   'can_submit': verified, 'needs_verification': not verified}


class OverviewView(APIView):
    """GET /compliance/sk/overview/ : dashboard cards and the barangay x category table, from the real records."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        bparam = _int(request, 'barangay', 1, 10**9)
        qs, me = _scope(request, bparam)
        if qs is None:
            return me
        sk.ensure_indexed()
        q = request.query_params
        category = q.get('category') if q.get('category') in CATEGORY_KEYS else None
        status = q.get('status') if q.get('status') in sk.STATUS_LABELS else None
        publication = q.get('publication') if q.get('publication') in ('published', 'unpublished') else None
        data = sk.build_monitoring(qs.order_by('barangay_name'), _year(request), timezone.localdate(), category=category, status=status,
                                   publication=publication, quarter=_int(request, 'quarter', 1, 4), month=_int(request, 'month', 1, 12))
        data['me'] = me
        data['barangays'] = [{'id': b.id, 'name': b.barangay_name} for b in qs.order_by('barangay_name')] if me['role'] == 'admin' \
            else [me['barangay']]
        data['years'] = list(range(timezone.localdate().year + 1, FIRST_YEAR - 1, -1))
        data['statuses'] = [{'key': k, 'label': v} for k, v in sk.STATUS_LABELS.items()]
        return Response(data)


class SlotsView(APIView):
    """GET /compliance/sk/slots/?barangay=&category=&year= : the periods of one category with their newest record and history."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        category = request.query_params.get('category')
        if category not in CATEGORY_KEYS:
            return Response({'detail': 'Choose a category.'}, status=http.HTTP_400_BAD_REQUEST)
        qs, me = _scope(request, _int(request, 'barangay', 1, 10**9))
        if qs is None:
            return me
        barangay = qs.first()
        if barangay is None:
            raise Http404
        sk.ensure_indexed()
        year = _year(request)
        slots = sk.slot_details(barangay, category, year, timezone.localdate())
        out = [{'label': s['label'], 'quarter': s['quarter'], 'month': s['month'], 'start': s['start'], 'end': s['end'],
                'deadline': s['deadline'], 'status': s['status'], 'status_label': s['status_label'], 'late': s['late'],
                'current': record_data(s['current']) if s['current'] else None,
                'history': [record_data(h) for h in s['history']]} for s in slots]
        extra = {}
        if category in sk.EXISTING_CATEGORIES:
            req = barangay.requirements.filter(requirement_type=category).first()
            extra['requirement'] = {'id': req.id, 'status': req.status, 'due_date': req.due_date, 'has_file': bool(req.file),
                                    'submitted_at': req.submitted_at} if req else None
            extra['manage_url'] = '/sk-requirements'  # the existing module where the document is uploaded
        if category in ('abyip', 'annual_budget'):
            from apps.programs.models import ProgramSubmission
            ppas = ProgramSubmission.objects.filter(barangay__iexact=barangay.barangay_name, submission_type='ppa') \
                .exclude(status__in=('draft', 'rejected')).order_by('-submitted_at')[:100]
            extra['ppas'] = [{'id': p.id, 'title': p.title, 'abyip_reference_code': p.abyip_reference_code, 'status': p.status,
                              'estimated_budget': str(p.estimated_budget) if p.estimated_budget is not None else None,
                              'period_of_implementation': p.period_of_implementation} for p in ppas]
            extra['ppa_budget_total'] = str(sum((p.estimated_budget or 0) for p in ppas))
            extra['manage_ppa_url'] = '/submissions'
        return Response({'barangay': {'id': barangay.id, 'name': barangay.barangay_name}, 'category': category, 'year': year,
                         'label': sk.CATEGORY_BY_KEY[category]['label'], 'slots': out, 'me': me, **extra})


class RecordCreateView(APIView):
    """POST /compliance/sk/records/ : submit an RCB (quarterly) or MIL (monthly) document, or a MIL 'NONE FOR THE PERIOD' declaration.
    CBYDP, ABYIP and the Annual Budget keep using their existing upload (SK Requirements)."""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    @transaction.atomic
    def post(self, request):
        d = request.data
        category = d.get('category')
        if category not in ('quarterly_cash', 'monthly_pr'):
            return Response({'detail': 'CBYDP, ABYIP and the Annual Budget are submitted through the existing SK Requirements page.',
                             'code': 'use_existing'}, status=http.HTTP_400_BAD_REQUEST)
        user = request.user
        if sk.is_admin(user):
            barangay = SKBarangay.objects.filter(pk=d.get('barangay') or 0, is_active=True).first()
            if barangay is None:
                return Response({'barangay': 'Choose the barangay.'}, status=http.HTTP_400_BAD_REQUEST)
        else:
            barangay = sk.own_barangay(user)
            if barangay is None:
                return _forbidden('Only SK officials of a barangay with an SK council can submit.')
            if not sk.is_verified(user):
                return Response({'detail': 'Please verify your identity first (Verify ID) before submitting compliance documents.',
                                 'code': 'verify_first'}, status=http.HTTP_403_FORBIDDEN)
        try:
            year = int(d.get('year'))
            quarter = int(d.get('quarter')) if category == 'quarterly_cash' else None
            month = int(d.get('month')) if category == 'monthly_pr' else None
        except (TypeError, ValueError):
            return Response({'detail': 'Choose the reporting period.'}, status=http.HTTP_400_BAD_REQUEST)
        today = timezone.localdate()
        if not (FIRST_YEAR <= year <= today.year + 1) or (quarter and not 1 <= quarter <= 4) or (month and not 1 <= month <= 12):
            return Response({'detail': 'That reporting period is not valid.'}, status=http.HTTP_400_BAD_REQUEST)
        slot = sk.slots_for(category, year)[(quarter or month) - 1]
        if slot['start'] > today:
            return Response({'detail': 'That period has not started yet.'}, status=http.HTTP_400_BAD_REQUEST)

        none = str(d.get('none_declaration', '')).lower() in ('true', '1', 'yes', 'on')
        file = request.FILES.get('file')
        if none and category != 'monthly_pr':
            return Response({'detail': 'A "NONE FOR THE PERIOD" declaration is only for the Monthly Itemized List.'}, status=http.HTTP_400_BAD_REQUEST)
        if none and file:
            return Response({'detail': 'Either upload a document or declare NONE FOR THE PERIOD, not both.'}, status=http.HTTP_400_BAD_REQUEST)
        if not none and not file:
            return Response({'file': ['Choose the document to upload. A blank submission is not a NONE FOR THE PERIOD declaration.']},
                            status=http.HTTP_400_BAD_REQUEST)
        if file:
            from rest_framework.exceptions import ValidationError
            try:
                check_upload(file, OFFICE_EXTS, MAX_UPLOAD, field='file')
            except ValidationError as exc:
                return Response(exc.detail, status=http.HTTP_400_BAD_REQUEST)

        existing = SKComplianceRecord.objects.filter(barangay=barangay, category=category, year=year, quarter=quarter, month=month).order_by('-id').first()
        if existing and existing.status != 'returned':
            return Response({'detail': 'This period already has a submission. A new one can be sent only if it is returned for correction.',
                             'code': 'already_submitted'}, status=http.HTTP_409_CONFLICT)

        title = 'NONE FOR THE PERIOD' if none else (str(d.get('title', '')).strip()[:255])
        rec = SKComplianceRecord.objects.create(
            barangay=barangay, category=category, year=year, quarter=quarter, month=month, file=file, original_name=getattr(file, 'name', '')[:255],
            is_none_declaration=none, title=title or sk.CATEGORY_BY_KEY[category]['short'], description=str(d.get('description', ''))[:3000],
            status='submitted', submitted_by=user, submitted_at=timezone.now())
        _audit(request, 'sk_compliance_submitted', rec, none_declaration=none, resubmission=existing is not None)
        sk.notify(sk.admin_users(), 'New SK compliance submission',
                  f'{barangay.barangay_name} submitted {sk.describe(rec)}{" (NONE FOR THE PERIOD)" if none else ""}. It is waiting for verification.',
                  '/admin/sk-compliance')
        return Response(record_data(rec), status=http.HTTP_201_CREATED)


class RecordReviewView(APIView):
    """POST /compliance/sk/records/<id>/review/ {action, remarks, ...} : LYDO only. start, verify, return, publish, unpublish, update."""
    permission_classes = [IsAuthenticated]

    TRANSITIONS = {
        'start': ({'submitted'}, 'under_verification'),
        'verify': ({'submitted', 'under_verification'}, 'verified'),
        'return': ({'submitted', 'under_verification', 'verified'}, 'returned'),
        'publish': ({'verified'}, 'published'),
        'unpublish': ({'published'}, 'verified'),
    }

    @transaction.atomic
    def post(self, request, pk):
        if not sk.is_admin(request.user):
            return _forbidden('Only LYDO administrators can review submissions.')
        rec = SKComplianceRecord.objects.select_for_update().select_related('barangay').filter(pk=pk).first()
        if rec is None:
            raise Http404
        action = request.data.get('action')
        remarks = str(request.data.get('remarks', '')).strip()[:2000]

        if 'description' in request.data:
            rec.description = str(request.data.get('description'))[:3000]
        if 'title' in request.data:
            rec.title = str(request.data.get('title'))[:255]
        for field, lo, hi in (('year', FIRST_YEAR, timezone.localdate().year + 1), ('period_end_year', FIRST_YEAR, timezone.localdate().year + 5)):
            if field in request.data and rec.category in sk.EXISTING_CATEGORIES:
                try:
                    v = int(request.data.get(field))
                except (TypeError, ValueError):
                    return Response({field: 'Enter a year.'}, status=http.HTTP_400_BAD_REQUEST)
                if not lo <= v <= hi:
                    return Response({field: 'That year is not valid.'}, status=http.HTTP_400_BAD_REQUEST)
                setattr(rec, field, v)
        if 'total_amount' in request.data and rec.category == 'annual_budget':
            raw = request.data.get('total_amount')
            try:
                rec.total_amount = None if raw in ('', None) else round(float(raw), 2)
            except (TypeError, ValueError):
                return Response({'total_amount': 'Enter an amount.'}, status=http.HTTP_400_BAD_REQUEST)

        if action in self.TRANSITIONS:
            allowed, target = self.TRANSITIONS[action]
            if rec.status not in allowed:
                return Response({'detail': f'This submission is "{sk.STATUS_LABELS[rec.status]}" and cannot be changed that way.'}, status=http.HTTP_409_CONFLICT)
            newer = SKComplianceRecord.objects.filter(barangay=rec.barangay, category=rec.category, year=rec.year, quarter=rec.quarter,
                                                      month=rec.month, id__gt=rec.id).exists()
            if newer and action != 'return':
                return Response({'detail': 'A newer submission exists for this period. Review that one instead.'}, status=http.HTTP_409_CONFLICT)
            if action == 'return' and not remarks:
                return Response({'remarks': ['Say what needs to be corrected.']}, status=http.HTTP_400_BAD_REQUEST)
            if action in ('verify', 'publish') and not (rec.file or rec.source_file_name or rec.is_none_declaration):
                return Response({'detail': 'There is no document to verify.'}, status=http.HTTP_400_BAD_REQUEST)
            rec.status = target
            if action != 'publish' and action != 'unpublish':
                rec.reviewed_by, rec.reviewed_at = request.user, timezone.now()
                if remarks or action == 'return':
                    rec.review_remarks = remarks
            if action == 'publish':
                rec.published_by, rec.published_at = request.user, timezone.now()
            if action == 'unpublish':
                rec.published_at = None
        elif action != 'update':
            return Response({'detail': 'Unknown action.'}, status=http.HTTP_400_BAD_REQUEST)
        rec.save()
        _audit(request, f'sk_compliance_{action}', rec, remarks=bool(remarks))

        link = '/sk-compliance'
        if action == 'return':
            sk.notify(sk.sk_users_of(rec.barangay), 'SK compliance document returned',
                      f'{sk.describe(rec)} was returned for correction. Please read the remarks and submit it again.', link)
        elif action == 'verify':
            sk.notify(sk.sk_users_of(rec.barangay), 'SK compliance document verified', f'{sk.describe(rec)} was verified by LYDO.', link)
        elif action == 'publish':
            sk.notify(sk.sk_users_of(rec.barangay), 'SK compliance document published',
                      f'{sk.describe(rec)} is now published on the FPDPB.', link)
        return Response(record_data(rec))


class QueueView(APIView):
    """GET /compliance/sk/queue/ : LYDO only. Submissions waiting for verification, and verified ones not yet published."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not sk.is_admin(request.user):
            return _forbidden('Only LYDO administrators can see the verification queue.')
        sk.ensure_indexed()
        now = timezone.now()
        rows = SKComplianceRecord.objects.filter(status__in=('submitted', 'under_verification', 'verified')).select_related('barangay', 'submitted_by').order_by('submitted_at')
        newest = {}
        for r in SKComplianceRecord.objects.order_by('id'):
            newest[(r.barangay_id, r.category, r.year, r.quarter, r.month)] = r.id
        out = []
        for r in rows:
            if newest.get((r.barangay_id, r.category, r.year, r.quarter, r.month)) != r.id:
                continue  # replaced by a newer submission
            out.append({**record_data(r), 'barangay': r.barangay.barangay_name, 'barangay_id': r.barangay_id,
                        'category_short': sk.CATEGORY_BY_KEY[r.category]['short'], 'period': sk.describe(r),
                        'waiting_days': (now - r.submitted_at).days if r.submitted_at else 0,
                        'stage': 'ready_to_publish' if r.status == 'verified' else 'to_verify'})
        return Response({'to_verify': [o for o in out if o['stage'] == 'to_verify'], 'ready_to_publish': [o for o in out if o['stage'] == 'ready_to_publish']})


def _open(record):
    if record.file:
        return record.file.open('rb')
    if record.source_file_name:
        try:
            return private_storage().open(record.source_file_name, 'rb')
        except FileNotFoundError:
            return default_storage.open(record.source_file_name, 'rb')  # not moved to the private folder yet
    raise FileNotFoundError


def _file_response(record, download=False):
    try:
        handle = _open(record)
    except (FileNotFoundError, ValueError):
        raise Http404('File not found.')
    name = os.path.basename(record.original_name or (record.file.name if record.file else record.source_file_name))
    ext = os.path.splitext(name)[1].lower()
    resp = FileResponse(handle, content_type=_INLINE.get(ext, 'application/octet-stream'))
    resp['Content-Disposition'] = ('inline' if ext in _INLINE and not download else 'attachment') + f'; filename="{name}"'
    resp['X-Content-Type-Options'] = 'nosniff'
    resp['Cache-Control'] = 'private, no-store'
    resp['Content-Security-Policy'] = "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'"
    return resp


class RecordFileView(APIView):
    """GET /compliance/sk/records/<id>/file/ : LYDO, or the SK of that same barangay. Nobody else, whatever the status."""
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        rec = SKComplianceRecord.objects.select_related('barangay').filter(pk=pk).first()
        if rec is None:
            raise Http404
        own = sk.own_barangay(request.user)
        if not (sk.is_admin(request.user) or (own is not None and own.pk == rec.barangay_id)):
            raise Http404
        return _file_response(rec, download=request.query_params.get('download') == '1')


class PublicListView(APIView):
    """GET /compliance/fpdpb/public/ : the FPDPB. Only verified AND published documents, no sign-in. No remarks, no submitter details."""
    permission_classes = [AllowAny]

    def get(self, request):
        q = request.query_params
        qs = SKComplianceRecord.objects.filter(status='published').select_related('barangay').order_by('-published_at')
        if _int(request, 'barangay', 1, 10**9):
            qs = qs.filter(barangay_id=_int(request, 'barangay', 1, 10**9))
        if q.get('category') in CATEGORY_KEYS:
            qs = qs.filter(category=q['category'])
        if q.get('year', '').isdigit():
            qs = qs.filter(year=int(q['year']))
        if _int(request, 'quarter', 1, 4):
            qs = qs.filter(quarter=_int(request, 'quarter', 1, 4))
        if _int(request, 'month', 1, 12):
            qs = qs.filter(month=_int(request, 'month', 1, 12))
        # a published record is replaced on the public page only when a NEWER one is published; until then the verified one stays visible
        items = []
        for r in qs[:1000]:
            newer = SKComplianceRecord.objects.filter(barangay=r.barangay, category=r.category, year=r.year, quarter=r.quarter,
                                                      month=r.month, id__gt=r.id, status='published').exists()
            if newer:
                continue
            cat = sk.CATEGORY_BY_KEY[r.category]
            items.append({
                'id': r.id, 'barangay': r.barangay.barangay_name, 'barangay_id': r.barangay_id, 'category': r.category,
                'category_short': cat['short'], 'category_label': cat['label'],
                'title': r.title or cat['short'], 'description': r.description, 'year': r.year, 'period_end_year': r.period_end_year,
                'quarter': r.quarter, 'month': r.month, 'period': sk.describe(r), 'published_at': r.published_at,
                'is_none_declaration': r.is_none_declaration, 'has_file': bool(r.file or r.source_file_name),
                'total_amount': str(r.total_amount) if r.total_amount is not None else None,
            })
        used = SKComplianceRecord.objects.filter(status='published')
        return Response({
            'items': items,
            'barangays': [{'id': b.id, 'name': b.barangay_name} for b in SKBarangay.objects.filter(pk__in=used.values('barangay_id')).order_by('barangay_name')],
            'years': sorted(set(used.values_list('year', flat=True)), reverse=True),
            'categories': [{'key': c['key'], 'short': c['short'], 'label': c['label']} for c in sk.CATEGORIES],
        })


class PublicFileView(APIView):
    """GET /compliance/fpdpb/files/<id>/ : the file of a PUBLISHED record only. Anything else is a 404, so guessing ids reveals nothing."""
    permission_classes = [AllowAny]

    def get(self, request, pk):
        rec = SKComplianceRecord.objects.filter(pk=pk, status='published').first()
        if rec is None or rec.is_none_declaration:
            raise Http404
        newer = SKComplianceRecord.objects.filter(barangay=rec.barangay_id, category=rec.category, year=rec.year, quarter=rec.quarter,
                                                  month=rec.month, id__gt=rec.id, status='published').exists()
        if newer:
            raise Http404
        return _file_response(rec, download=request.query_params.get('download') == '1')
