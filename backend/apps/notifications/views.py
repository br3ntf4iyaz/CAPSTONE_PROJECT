import logging

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.db.models import Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsAdminRole
from .models import BroadcastNotification, Notification
from .serializers import (
    BroadcastCreateSerializer,
    BroadcastNotificationSerializer,
    NotificationSerializer,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helper – importable by other apps
# ---------------------------------------------------------------------------

def create_notification(user, title, message, notif_type, link=''):
    """
    Create a Notification for `user`.

    Usage from another app::

        from apps.notifications.views import create_notification
        create_notification(user, 'New Badge!', 'You earned the Leader badge.', 'badge')
    """
    return Notification.objects.create(
        user=user,
        title=title,
        message=message,
        notification_type=notif_type,
        link=link,
    )


# ---------------------------------------------------------------------------
# Target audience → queryset filter
# ---------------------------------------------------------------------------

def _resolve_recipients(target_audience: str):
    """Return a User queryset matching the given audience slug."""
    from django.contrib.auth import get_user_model
    User = get_user_model()

    audience_filters = {
        'all':          Q(),
        'sk':           Q(role='youth', youth_type='sk'),
        'youth_leaders': Q(role='youth', youth_type='youth_org_leader'),
        'general':      Q(role='youth', youth_type='general_youth'),
        'lgu_admin':    Q(role__in=['lgu_admin', 'super_admin']),
    }
    q = audience_filters.get(target_audience)
    if q is None:
        raise ValueError(f"Unknown target_audience: {target_audience!r}")
    return User.objects.filter(q).filter(is_active=True).distinct()


# ---------------------------------------------------------------------------
# Email helpers
# ---------------------------------------------------------------------------

def _build_email_html(title: str, message: str) -> str:
    """Return a simple branded HTML email body."""
    safe_message = message.replace('\n', '<br>')
    return f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="600" cellpadding="0" cellspacing="0"
             style="max-width:600px;background:#ffffff;border-radius:12px;
                    overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <!-- Header -->
        <tr>
          <td style="background:#1d4ed8;padding:24px 32px;">
            <p style="margin:0;color:#ffffff;font-size:13px;letter-spacing:.05em;
                      text-transform:uppercase;opacity:.8;">
              Lucena City Youth Development Office
            </p>
            <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;line-height:1.3;">
              {title}
            </h1>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;color:#334155;font-size:15px;line-height:1.7;">
            <p style="margin:0;">{safe_message}</p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
            <p style="margin:0;color:#94a3b8;font-size:12px;">
              You received this notification because you are registered on the
              <strong>Lucena Youth Leadership Hub</strong>.<br>
              If you believe this was sent in error, please contact
              <a href="mailto:lydo@lucena.gov.ph"
                 style="color:#3b82f6;">lydo@lucena.gov.ph</a>.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


def _send_broadcast_emails(recipients, title: str, message: str, attachment=None) -> int:
    """
    Send one email per recipient.  Opens a single SMTP connection for all.
    Returns the count of successfully sent emails.

    `attachment` is an UploadedFile (or None).  Its content is read once and
    attached to every message; the file pointer is reset afterward so Django
    can still save it to disk.
    """
    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', settings.EMAIL_HOST_USER)
    html_body = _build_email_html(title, message)
    sent = 0

    # Read attachment bytes once so we don't exhaust the file pointer per recipient
    attachment_data = None
    if attachment:
        try:
            attachment.seek(0)
            attachment_data = {
                'name': attachment.name,
                'content': attachment.read(),
                'mimetype': getattr(attachment, 'content_type', 'application/octet-stream'),
            }
            attachment.seek(0)  # reset so Django can save the file to disk after this call
        except Exception as exc:
            logger.warning("Could not read attachment for email: %s", exc)

    # Build all messages first, then send in one connection
    messages = []
    for user in recipients:
        if not user.email:
            continue
        msg = EmailMultiAlternatives(
            subject=f"[LYDO] {title}",
            body=message,          # plain-text fallback
            from_email=from_email,
            to=[user.email],
        )
        msg.attach_alternative(html_body, "text/html")
        if attachment_data:
            msg.attach(
                attachment_data['name'],
                attachment_data['content'],
                attachment_data['mimetype'],
            )
        messages.append(msg)

    if not messages:
        return 0

    # Use a single SMTP connection
    try:
        from django.core.mail import get_connection
        connection = get_connection()
        connection.open()
        for msg in messages:
            try:
                msg.connection = connection
                msg.send()
                sent += 1
            except Exception as exc:
                logger.warning("Failed to send email to %s: %s", msg.to, exc)
        connection.close()
    except Exception as exc:
        logger.error("SMTP connection failed: %s", exc)

    return sent


# ---------------------------------------------------------------------------
# ViewSet
# ---------------------------------------------------------------------------

class NotificationViewSet(viewsets.ModelViewSet):
    """
    User-facing endpoints (authentication required):
      GET  /notifications/             – own inbox, unread first
      GET  /notifications/{id}/        – single notification
      POST /notifications/{id}/mark_read/
      POST /notifications/mark_all_read/

    Admin-only endpoints (IsAdminRole required):
      POST /notifications/             – broadcast to target audience
      GET  /notifications/admin-history/ – list past broadcasts
    """

    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    http_method_names = ['get', 'post', 'head', 'options']

    def get_permissions(self):
        if self.action in ('create', 'admin_history'):
            return [IsAuthenticated(), IsAdminRole()]
        return [IsAuthenticated()]

    def get_queryset(self):
        return (
            Notification.objects.filter(user=self.request.user)
            .order_by('is_read', '-created_at')
        )

    # ── Admin: broadcast ──────────────────────────────────────────────────

    def create(self, request):
        """
        POST /notifications/
        Admin sends a notification (and optionally an email) to a target audience.
        """
        ser = BroadcastCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        recipients = list(_resolve_recipients(data['target_audience']))

        # 1. Send emails first (attachment still in memory; _send_broadcast_emails
        #    resets the file pointer afterward so Django can still save it to disk)
        email_sent_count = 0
        if data['send_email']:
            email_sent_count = _send_broadcast_emails(
                recipients, data['title'], data['message'],
                attachment=data.get('attachment'),
            )

        # 2. Record the broadcast (saves attachment to disk)
        broadcast = BroadcastNotification.objects.create(
            title=data['title'],
            message=data['message'],
            target_audience=data['target_audience'],
            via_email=data['send_email'],
            recipient_count=len(recipients),
            email_sent_count=email_sent_count,
            sent_by=request.user,
            attachment=data.get('attachment'),
        )

        # 3. Create inbox Notification for each recipient, linking to the
        #    attachment so users can open the document from their inbox
        attachment_link = ''
        if broadcast.attachment:
            attachment_link = request.build_absolute_uri(broadcast.attachment.url)

        Notification.objects.bulk_create([
            Notification(
                user=r,
                title=data['title'],
                message=data['message'],
                notification_type='announcement',
                link=attachment_link,
            )
            for r in recipients
        ])

        return Response(
            BroadcastNotificationSerializer(broadcast, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    # ── Admin: history ────────────────────────────────────────────────────

    @action(detail=False, methods=['get'], url_path='admin-history')
    def admin_history(self, request):
        """GET /notifications/admin-history/ — returns past broadcasts."""
        broadcasts = BroadcastNotification.objects.select_related('sent_by').all()
        serializer = BroadcastNotificationSerializer(broadcasts, many=True, context={'request': request})
        return Response(serializer.data)

    # ── User: mark read ───────────────────────────────────────────────────

    @action(detail=True, methods=['post'], url_path='mark_read')
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        if not notification.is_read:
            notification.is_read = True
            notification.read_at = timezone.now()
            notification.save(update_fields=['is_read', 'read_at'])
        return Response(self.get_serializer(notification).data)

    @action(detail=False, methods=['get'], url_path='unread_count')
    def unread_count(self, request):
        count = Notification.objects.filter(user=request.user, is_read=False).count()
        return Response({'count': count})

    @action(detail=False, methods=['post'], url_path='mark_all_read')
    def mark_all_read(self, request):
        now = timezone.now()
        updated = (
            Notification.objects.filter(user=request.user, is_read=False)
            .update(is_read=True, read_at=now)
        )
        return Response(
            {'detail': f'{updated} notification(s) marked as read.'},
            status=status.HTTP_200_OK,
        )
