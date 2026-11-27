"""The executive board of a youth organization.

The public sees the officers people would write to (president, vice presidents, secretary, PRO). The officers who handle money or
discipline (treasurer, auditor, sergeant-at-arms, and any custom title) are shown only to the organization's leader and to LYDO,
for YORP compliance and data privacy.
"""
from rest_framework import serializers

from .models import OrgOfficer

POSITIONS = [
    ('president', 'President'),
    ('vice_president', 'Vice President'),
    ('vp_internal', 'VP for Internal Affairs'),
    ('vp_external', 'VP for External Affairs'),
    ('secretary', 'Secretary'),
    ('treasurer', 'Treasurer'),
    ('auditor', 'Auditor'),
    ('pro', 'Public Relations Officer (PRO)'),
    ('sergeant', 'Sergeant-at-Arms / Peace Officer'),
    ('other', 'Other (Custom Title)'),
]
POSITION_LABEL = dict(POSITIONS)
PUBLIC_POSITIONS = {'president', 'vice_president', 'vp_internal', 'vp_external', 'secretary', 'pro'}
MAX_OFFICERS = 20


def clean_officers(rows, sanitize):
    """Check a submitted list of officers. Returns [{position, custom_title, name, is_me}] or raises a readable error."""
    if rows in (None, ''):
        return []
    if not isinstance(rows, list):
        raise serializers.ValidationError({'officers': 'Send the officers as a list.'})
    if len(rows) > MAX_OFFICERS:
        raise serializers.ValidationError({'officers': f'An organization can list up to {MAX_OFFICERS} officers.'})
    out = []
    for r in rows:
        if not isinstance(r, dict):
            raise serializers.ValidationError({'officers': 'Each officer needs a position and a name.'})
        position = str(r.get('position', '')).strip()
        name = sanitize(str(r.get('name', '')).strip())[:200]
        custom = sanitize(str(r.get('custom_title', '')).strip())[:60]
        if position not in POSITION_LABEL:
            raise serializers.ValidationError({'officers': 'Choose a position from the list.'})
        if not name:
            raise serializers.ValidationError({'officers': f'Write the name of the {POSITION_LABEL[position]}.'})
        if position == 'other' and not custom:
            raise serializers.ValidationError({'officers': 'Write the title for the officer marked Other.'})
        out.append({'position': position, 'custom_title': custom if position == 'other' else '', 'name': name, 'is_me': bool(r.get('is_me'))})
    if sum(1 for o in out if o['position'] == 'president') > 1:
        raise serializers.ValidationError({'officers': 'An organization has one president.'})
    return out


def save_officers(org, rows, user):
    """Replace the officers of an organization. The row marked is_me is linked to the signed-in leader."""
    org.officers.all().delete()
    order = {k: i for i, (k, _) in enumerate(POSITIONS)}
    linked = False
    for r in sorted(rows, key=lambda x: order[x['position']]):
        mine = r['is_me'] and not linked and user is not None
        linked = linked or mine
        OrgOfficer.objects.create(organization=org, position=r['position'], custom_title=r['custom_title'], name=r['name'], user=user if mine else None)


class OfficerSerializer(serializers.ModelSerializer):
    position_label = serializers.SerializerMethodField()
    is_public = serializers.SerializerMethodField()
    is_me = serializers.SerializerMethodField()

    class Meta:
        model = OrgOfficer
        fields = ['id', 'position', 'position_label', 'custom_title', 'name', 'is_public', 'is_me']

    def get_position_label(self, obj):
        return obj.custom_title if obj.position == 'other' and obj.custom_title else POSITION_LABEL.get(obj.position, obj.position)

    def get_is_public(self, obj):
        return obj.position in PUBLIC_POSITIONS

    def get_is_me(self, obj):
        request = self.context.get('request')
        return bool(request and request.user.is_authenticated and obj.user_id == request.user.id)


def officers_for(org, request, can_see_all):
    rows = list(org.officers.all())
    if not can_see_all:
        rows = [o for o in rows if o.position in PUBLIC_POSITIONS]
    return OfficerSerializer(rows, many=True, context={'request': request}).data
