"""Course completion certificate as a PDF (A4 landscape), generated on request from the saved certificate record.
The wording comes from the snapshot stored when the certificate was issued, so it never changes later."""
import io

from django.utils import timezone
from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.utils import simpleSplit
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

from .models import CertificateSetting

BLUE = HexColor('#0038a8')
GOLD = HexColor('#d99a00')
INK = HexColor('#1f2937')
MUTED = HexColor('#6b7280')


def _fit(text, font, size, max_width, min_size=14):
    while size > min_size and stringWidth(text, font, size) > max_width:
        size -= 1
    return size


def recipient_name(certificate):
    """The name typed at enrollment (kept on the certificate), never the account username."""
    enrollment = certificate.enrollment
    user = enrollment.user
    return (
        certificate.recipient_name or enrollment.certificate_name or user.get_full_name() or user.email
    ).strip()


def build_certificate_pdf(certificate):
    enrollment = certificate.enrollment
    course = enrollment.course
    name = recipient_name(certificate)
    title = certificate.course_title or course.title
    done_on = certificate.completed_on or timezone.localtime(enrollment.completed_at or certificate.issued_at).date()
    branding = CertificateSetting.get()
    audience = certificate.audience or course.get_audience_display()
    statement = certificate.statement or (
        f'This certificate is awarded to {name} for successfully completing {title}.')
    modules = list(certificate.modules_summary or [])
    signatories = list(certificate.signatories or [])

    buf = io.BytesIO()
    page_w, page_h = landscape(A4)
    c = canvas.Canvas(buf, pagesize=(page_w, page_h))
    c.setTitle(f'Certificate of Completion - {title}')
    c.setAuthor(branding.organization_name)
    c.setSubject(f'Certificate {certificate.certificate_number}')

    c.setFillColor(white)
    c.rect(0, 0, page_w, page_h, stroke=0, fill=1)
    c.setStrokeColor(BLUE)
    c.setLineWidth(8)
    c.rect(18, 18, page_w - 36, page_h - 36, stroke=1, fill=0)
    c.setStrokeColor(GOLD)
    c.setLineWidth(1.5)
    c.rect(32, 32, page_w - 64, page_h - 64, stroke=1, fill=0)

    cx = page_w / 2

    seal_y = page_h - 78
    c.setFillColor(BLUE)
    c.circle(cx, seal_y, 30, stroke=0, fill=1)
    c.setStrokeColor(GOLD)
    c.setLineWidth(2)
    c.circle(cx, seal_y, 26, stroke=1, fill=0)
    c.setFillColor(white)
    c.setFont('Helvetica-Bold', 15)
    c.drawCentredString(cx, seal_y - 2, 'LYDO')
    c.setFillColor(GOLD)
    c.setFont('Helvetica-Bold', 5.5)
    c.drawCentredString(cx, seal_y - 12, 'LUCENA YOUTH')

    c.setFillColor(BLUE)
    c.setFont('Helvetica-Bold', 11)
    c.drawCentredString(cx, page_h - 128, branding.organization_name.upper())
    c.setFillColor(MUTED)
    c.setFont('Helvetica', 9)
    c.drawCentredString(cx, page_h - 141, branding.platform_name)

    c.setFillColor(INK)
    c.setFont('Helvetica-Bold', 28)
    c.drawCentredString(cx, page_h - 178, 'CERTIFICATE OF COMPLETION')

    c.setFillColor(MUTED)
    c.setFont('Helvetica', 11)
    c.drawCentredString(cx, page_h - 202, 'This is to certify that')

    size = _fit(name, 'Helvetica-Bold', 34, page_w - 160)
    c.setFillColor(BLUE)
    c.setFont('Helvetica-Bold', size)
    c.drawCentredString(cx, page_h - 240, name)
    c.setStrokeColor(GOLD)
    c.setLineWidth(1)
    c.line(cx - 200, page_h - 249, cx + 200, page_h - 249)

    # course + audience
    c.setFillColor(INK)
    y = page_h - 276
    for line in simpleSplit(title, 'Helvetica-Bold', 19, page_w - 180)[:2]:
        c.setFont('Helvetica-Bold', 19)
        c.drawCentredString(cx, y, line)
        y -= 23
    c.setFillColor(MUTED)
    c.setFont('Helvetica-Oblique', 9.5)
    c.drawCentredString(cx, y + 2, f'Course for {audience}')
    y -= 18

    # accomplishment statement
    c.setFillColor(INK)
    c.setFont('Helvetica', 10.5)
    for line in simpleSplit(statement, 'Helvetica', 10.5, page_w - 190)[:4]:
        c.drawCentredString(cx, y, line)
        y -= 14

    # modules completed
    if modules:
        y -= 6
        c.setFillColor(MUTED)
        c.setFont('Helvetica-Bold', 8)
        c.drawCentredString(cx, y, 'MODULES COMPLETED')
        y -= 11
        c.setFont('Helvetica', 8.5)
        for line in simpleSplit('  |  '.join(modules), 'Helvetica', 8.5, page_w - 200)[:2]:
            c.drawCentredString(cx, y, line)
            y -= 11

    # completion date + signatories + number
    c.setFillColor(MUTED)
    c.setFont('Helvetica', 10)
    c.drawCentredString(cx, 128, f'Completed on {done_on:%B} {done_on.day}, {done_on.year}')

    if signatories:
        n = min(len(signatories), 2)
        xs = [cx] if n == 1 else [cx - 170, cx + 170]
        for x, sig in zip(xs, signatories[:2]):
            c.setStrokeColor(INK)
            c.setLineWidth(0.8)
            c.line(x - 90, 102, x + 90, 102)
            c.setFillColor(INK)
            c.setFont('Helvetica-Bold', 10)
            c.drawCentredString(x, 90, sig['name'])
            c.setFillColor(MUTED)
            c.setFont('Helvetica', 8.5)
            c.drawCentredString(x, 79, sig.get('title', ''))

    c.setFillColor(INK)
    c.setFont('Helvetica-Bold', 9.5)
    c.drawCentredString(cx, 58, f'Certificate No. {certificate.certificate_number}')
    c.setFillColor(MUTED)
    c.setFont('Helvetica', 7.5)
    c.drawCentredString(cx, 46, branding.footer_note)

    c.showPage()
    c.save()
    return buf.getvalue()
