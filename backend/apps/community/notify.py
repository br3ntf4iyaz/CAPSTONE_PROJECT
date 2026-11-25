"""
Notifications for Community Feed activity (comments and reactions on someone's post).

Everything runs on the server, right after the comment or reaction is saved, and uses the
existing Notification table, so nothing depends on the browser. The post owner never gets a
notification for their own activity.
"""
from datetime import timedelta

from django.utils import timezone

from apps.notifications.models import Notification

COMMENT = 'community_comment'
REACTION = 'community_reaction'

ACCOUNT_TYPES = {
    'general_youth': 'General Youth',
    'sk': 'SK Official',
    'youth_org_leader': 'Youth Organization Leader',
}
ADMIN_ROLES = {'lgu_admin': 'LYDO Admin', 'super_admin': 'LYDO Admin'}


def account_type(user) -> str:
    role = getattr(user, 'role', '')
    if role in ADMIN_ROLES:
        return ADMIN_ROLES[role]
    return ACCOUNT_TYPES.get(getattr(user, 'youth_type', '') or 'general_youth', 'Youth')


def name_of(user) -> str:
    return user.get_full_name() or user.email


def _noun(post) -> str:
    return 'photo' if post.images.exists() else 'post'


def post_link(post_id, comment_id=None) -> str:
    return f'/community?post={post_id}' + (f'&comment={comment_id}' if comment_id else '')


def notify_comment(post, comment, actor):
    """One notification per comment, to the post owner. Skips the owner's own comments."""
    if post.author_id == actor.id:
        return None
    preview = comment.content.strip()
    preview = preview if len(preview) <= 100 else preview[:97] + '…'
    # a repeated request (double click, retry) must not produce a second identical notification
    recent = Notification.objects.filter(
        user_id=post.author_id, notification_type=COMMENT, actor=actor,
        post_id=post.id, message=preview, created_at__gte=timezone.now() - timedelta(seconds=10),
    )
    if recent.exists():
        return None
    return Notification.objects.create(
        user_id=post.author_id,
        actor=actor,
        title=f'{name_of(actor)} commented on your {_noun(post)}.',
        message=preview,
        notification_type=COMMENT,
        link=post_link(post.id, comment.id),
        post_id=post.id,
        comment_id=comment.id,
    )


def _reaction_title(post, reactors) -> str:
    """'A reacted…', 'A and B…', 'A, B and 8 others…' (reactors: newest first)."""
    names = [name_of(u) for u in reactors[:2]]
    total = len(reactors)
    noun = _noun(post)
    if total == 1:
        who = names[0]
    elif total == 2:
        who = f'{names[0]} and {names[1]}'
    else:
        who = f'{names[0]}, {names[1]} and {total - 2} other{"s" if total - 2 != 1 else ""}'
    return f'{who} reacted to your {noun}.'


def sync_reaction_notification(post, actor=None, bump=False):
    """
    Keep ONE grouped reaction notification per post, to the post owner.

    - `bump=True` (somebody just reacted): it becomes unread again and moves to the top.
    - `bump=False` (somebody removed their reaction): the text and count are refreshed quietly,
      and the notification disappears when nobody is left to show.
    The owner's own reaction is never counted.
    """
    from .models import PostReaction

    reactions = (PostReaction.objects.filter(post=post).exclude(user_id=post.author_id)
                 .select_related('user').order_by('-created_at', '-id'))
    reactors = [r.user for r in reactions]
    existing = Notification.objects.filter(user_id=post.author_id, notification_type=REACTION, post_id=post.id).first()

    if not reactors:
        if existing:
            existing.delete()
        return None

    title = _reaction_title(post, reactors)
    latest = reactors[0]
    if existing:
        existing.title = title
        existing.actor = latest
        existing.link = post_link(post.id)
        fields = ['title', 'actor', 'link']
        if bump:
            existing.is_read = False
            existing.read_at = None
            fields += ['is_read', 'read_at']
        existing.save(update_fields=fields)
        if bump:
            Notification.objects.filter(pk=existing.pk).update(created_at=timezone.now())
        return existing
    if not bump:
        return None
    return Notification.objects.create(
        user_id=post.author_id, actor=latest, title=title, message='',
        notification_type=REACTION, link=post_link(post.id), post_id=post.id,
    )


def forget_post(post_id):
    """The post was deleted: drop its notifications so no link is left pointing nowhere."""
    Notification.objects.filter(post_id=post_id, notification_type__in=[COMMENT, REACTION]).delete()


def forget_comment(comment_id):
    Notification.objects.filter(comment_id=comment_id, notification_type=COMMENT).delete()
