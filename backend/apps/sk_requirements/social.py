"""Rules for the Facebook links and public contact of SK officials. Nothing here talks to Facebook: links are checked as text only."""
import re
from urllib.parse import parse_qsl, urlencode, urlsplit

import bleach
from rest_framework.exceptions import ValidationError

FB_HOSTS = {'facebook.com', 'www.facebook.com', 'm.facebook.com', 'web.facebook.com', 'mbasic.facebook.com'}
# first path segments that are not a person or a page (login screens, share dialogs, trackers...)
BLOCKED_FIRST = {'login', 'login.php', 'dialog', 'sharer', 'sharer.php', 'plugins', 'tr', 'l.php', 'recover', 'help', 'policies',
                 'privacy', 'settings', 'checkpoint', 'logout.php', 'ajax', 'ads', 'business', 'groups_browse'}
KEEP_QUERY = {'id', 'story_fbid', 'fbid', 'set'}
LIMIT = 300
SEGMENT = re.compile(r'[A-Za-z0-9._\-%]+')


def _bad(msg):
    raise ValidationError(msg)


def _split(value, what):
    value = (value or '').strip()
    if len(value) > LIMIT or re.search(r'\s', value):
        _bad(f'The {what} link is not valid.')
    if not re.match(r'^https?://', value, re.I):
        if re.match(r'^(www\.|m\.)?facebook\.com/', value, re.I):
            value = 'https://' + value
        else:
            _bad(f'The {what} link must start with https://')
    p = urlsplit(value)
    if p.username or p.password or p.port not in (None, 80, 443):
        _bad(f'The {what} link is not valid.')
    return p


def clean_facebook_url(value, what='Facebook', allow_post_hosts=False):
    """Return a normalised https://www.facebook.com/... link, '' when empty, or raise a plain-language error."""
    if not (value or '').strip():
        return ''
    p = _split(value, what)
    host = (p.hostname or '').lower()
    if allow_post_hosts and host == 'fb.watch' and p.path.strip('/') and SEGMENT.fullmatch(p.path.strip('/')):
        return f'https://fb.watch/{p.path.strip("/")}/'
    if host not in FB_HOSTS:
        _bad(f'The {what} link must be a facebook.com link (for example https://www.facebook.com/username).')
    segments = [s for s in p.path.split('/') if s]
    query = {k: v for k, v in parse_qsl(p.query) if k in KEEP_QUERY}
    if segments and segments[0].lower() == 'profile.php':
        if not re.fullmatch(r'\d{5,25}', query.get('id', '')):
            _bad(f'The {what} link needs the profile number, like https://www.facebook.com/profile.php?id=1234567890')
        return f'https://www.facebook.com/profile.php?id={query["id"]}'
    if segments and segments[0].lower() == 'permalink.php':
        if not (allow_post_hosts and re.fullmatch(r'\d{5,25}', query.get('story_fbid', '')) and re.fullmatch(r'\d{5,25}', query.get('id', ''))):
            _bad(f'The {what} link is not valid.')
        return f'https://www.facebook.com/permalink.php?{urlencode({"story_fbid": query["story_fbid"], "id": query["id"]})}'
    if not segments or segments[0].lower() in BLOCKED_FIRST:
        _bad(f'The {what} link must point to a profile or page, for example https://www.facebook.com/username')
    if not all(SEGMENT.fullmatch(s) for s in segments):
        _bad(f'The {what} link is not valid.')
    return 'https://www.facebook.com/' + '/'.join(segments) + ('/' if len(segments) > 1 else '')


def clean_messenger_url(value):
    """A Messenger link: m.me/name, messenger.com/t/name or facebook.com/messages/t/name."""
    if not (value or '').strip():
        return ''
    raw = value.strip()
    if re.match(r'^m\.me/', raw, re.I):
        raw = 'https://' + raw
    p = _split(raw, 'Messenger')
    host = (p.hostname or '').lower()
    segments = [s for s in p.path.split('/') if s]
    ok = all(SEGMENT.fullmatch(s) for s in segments)
    if host in ('m.me', 'www.m.me') and len(segments) == 1 and ok:
        return f'https://m.me/{segments[0]}'
    if host in ('messenger.com', 'www.messenger.com') and len(segments) == 2 and segments[0] == 't' and ok:
        return f'https://www.messenger.com/t/{segments[1]}'
    if host in FB_HOSTS and len(segments) == 3 and segments[:2] == ['messages', 't'] and ok:
        return f'https://www.facebook.com/messages/t/{segments[2]}'
    _bad('The Messenger link must look like https://m.me/username')


def clean_text(value, limit):
    return bleach.clean(str(value or ''), tags=[], strip=True).strip()[:limit]


def clean_phone(value):
    value = str(value or '').strip()
    if not value:
        return ''
    if not re.fullmatch(r'[0-9+\-() ]{7,20}', value):
        _bad('The contact number may contain only digits, spaces and + - ( ).')
    return value


def clean_email(value):
    from django.core.exceptions import ValidationError as DjangoError
    from django.core.validators import validate_email
    value = str(value or '').strip()
    if not value:
        return ''
    try:
        validate_email(value)
    except DjangoError:
        _bad('Enter a valid email address.')
    return value[:254]


def public_social(social, full=False):
    """The dict sent to the browser. The public gets nothing unless a manager made it visible; managers (full=True) see everything."""
    base = {'visible': False, 'activities': []}
    if social is None:
        return base
    if not (full or social.social_links_visibility):
        return base
    return {
        'visible': social.social_links_visibility,
        'facebook_profile_url': social.facebook_profile_url,
        'facebook_page_url': social.facebook_page_url,
        'messenger_url': social.messenger_url,
        'public_email': social.public_email,
        'public_contact_number': social.public_contact_number,
        'public_bio': social.public_bio,
        'activities': [
            {'id': a.id, 'title': a.title, 'description': a.description, 'facebook_post_url': a.facebook_post_url,
             'activity_date': a.activity_date.isoformat() if a.activity_date else None}
            for a in social.activities.all()
        ],
    }
