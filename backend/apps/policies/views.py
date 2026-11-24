from django.db import transaction
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import AuditLog
from apps.accounts.permissions import IsAdminRole

from .defaults import DEFAULTS
from .models import PolicyDocument, PolicyRevision, SLUG_CHOICES

SLUGS = [s for s, _ in SLUG_CHOICES]


def get_policy(slug):
    """The policy page, created from the draft text the first time it is asked for."""
    title, content = DEFAULTS[slug]
    policy, created = PolicyDocument.objects.get_or_create(slug=slug, defaults={'title': title, 'content': content})
    if created:
        PolicyRevision.objects.create(policy=policy, version=policy.version, title=policy.title, content=policy.content)
    return policy


def current_versions():
    """'terms:2,privacy:1': recorded on an account when the person acknowledges the policies."""
    return ','.join(f'{s}:{get_policy(s).version}' for s in ('terms', 'privacy'))


def policy_data(policy, full=True):
    data = {'slug': policy.slug, 'title': policy.title, 'version': policy.version,
            'updated_at': policy.updated_at, 'needs_review': policy.needs_review}
    if full:
        data['content'] = policy.content
    return data


class PolicyEditSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=200, required=False)
    content = serializers.CharField(required=False, allow_blank=False, max_length=60000)
    reviewed = serializers.BooleanField(required=False)


class PolicyListView(APIView):
    """GET /api/policies/ : public. The three policies and their versions."""
    permission_classes = [AllowAny]

    def get(self, request):
        return Response([policy_data(get_policy(s), full=False) for s in SLUGS])


class PolicyDetailView(APIView):
    """GET public. PUT/PATCH administrators only: saves a new version and keeps the old one."""

    def get_permissions(self):
        return [AllowAny()] if self.request.method == 'GET' else [IsAuthenticated(), IsAdminRole()]

    def get(self, request, slug):
        if slug not in SLUGS:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(policy_data(get_policy(slug)))

    @transaction.atomic
    def _save(self, request, slug):
        if slug not in SLUGS:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        ser = PolicyEditSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        policy = get_policy(slug)
        changed = ('title' in d and d['title'] != policy.title) or ('content' in d and d['content'] != policy.content)
        if changed:
            policy.title = d.get('title', policy.title)
            policy.content = d.get('content', policy.content)
            policy.version += 1
            policy.needs_review = True  # new wording has to be reviewed again
            PolicyRevision.objects.create(policy=policy, version=policy.version, title=policy.title,
                                          content=policy.content, edited_by=request.user)
        if 'reviewed' in d:
            policy.needs_review = not d['reviewed']
        policy.updated_by = request.user
        policy.save()
        AuditLog.objects.create(user=request.user, action='policy_updated', model_name='PolicyDocument', object_id=policy.pk,
                                details={'slug': slug, 'version': policy.version, 'reviewed': not policy.needs_review})
        return Response(policy_data(policy))

    def put(self, request, slug):
        return self._save(request, slug)

    def patch(self, request, slug):
        return self._save(request, slug)


class PolicyRevisionsView(APIView):
    """GET /api/policies/<slug>/revisions/ : administrators only."""
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request, slug):
        if slug not in SLUGS:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        rows = get_policy(slug).revisions.select_related('edited_by')
        return Response([{
            'version': r.version, 'title': r.title, 'content': r.content, 'created_at': r.created_at,
            'edited_by': r.edited_by.full_name if r.edited_by else '',
        } for r in rows])
