"""LYDO admin: the central definition of the ten requirements, and their OFFICIAL deadlines."""
import bleach
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import AuditLog
from apps.accounts.permissions import IsAdminRole
from apps.accounts.views import get_client_ip

from .models import REQUIREMENT_CHOICES, SKBarangay, SKDeadline, SKRequirementConfig
from .states import ensure_configs

CODES = [c for c, _ in REQUIREMENT_CHOICES]


def _audit(request, action_name, obj, **details):
    AuditLog.objects.create(user=request.user, action=action_name, model_name=type(obj).__name__, object_id=obj.pk,
                            ip_address=get_client_ip(request), details={'by': request.user.email, **details})


class ConfigSerializer(serializers.ModelSerializer):
    label = serializers.SerializerMethodField()
    barangays = serializers.PrimaryKeyRelatedField(many=True, queryset=SKBarangay.objects.all(), required=False)

    class Meta:
        model = SKRequirementConfig
        fields = ['id', 'code', 'label', 'description', 'instructions', 'is_active', 'order', 'applies_to_all', 'barangays']
        read_only_fields = ['id', 'code', 'label', 'order']

    def get_label(self, obj):
        return obj.get_code_display()

    def validate_description(self, v):
        return bleach.clean(v, tags=[], strip=True)[:1000]

    def validate_instructions(self, v):
        return bleach.clean(v, tags=[], strip=True)[:2000]


class ConfigViewSet(mixins.ListModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    serializer_class = ConfigSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]
    pagination_class = None
    http_method_names = ['get', 'patch', 'head', 'options']

    def get_queryset(self):
        ensure_configs()
        return SKRequirementConfig.objects.prefetch_related('barangays')

    def perform_update(self, serializer):
        obj = serializer.save()
        _audit(self.request, 'sk_requirement_config_changed', obj, code=obj.code, fields=sorted(serializer.validated_data.keys()))


class DeadlineSerializer(serializers.ModelSerializer):
    label = serializers.SerializerMethodField()
    barangays = serializers.PrimaryKeyRelatedField(many=True, queryset=SKBarangay.objects.all(), required=False)

    class Meta:
        model = SKDeadline
        fields = ['id', 'code', 'label', 'year', 'quarter', 'month', 'deadline', 'is_active', 'applies_to_all', 'barangays', 'note']

    def get_label(self, obj):
        return obj.get_code_display()

    def validate(self, attrs):
        code = attrs.get('code') or getattr(self.instance, 'code', None)
        quarter = attrs.get('quarter', getattr(self.instance, 'quarter', None))
        month = attrs.get('month', getattr(self.instance, 'month', None))
        if code == 'quarterly_cash':
            if not quarter or not 1 <= quarter <= 4 or month:
                raise serializers.ValidationError({'quarter': 'Choose the quarter (1 to 4) for the RCB.'})
        elif code == 'monthly_pr':
            if not month or not 1 <= month <= 12 or quarter:
                raise serializers.ValidationError({'month': 'Choose the month for the MIL.'})
        elif quarter or month:
            raise serializers.ValidationError({'code': 'Only the RCB has quarters and only the MIL has months.'})
        year = attrs.get('year', getattr(self.instance, 'year', None))
        if year is not None and not 2020 <= year <= 2100:
            raise serializers.ValidationError({'year': 'That year is not valid.'})
        all_ = attrs.get('applies_to_all', getattr(self.instance, 'applies_to_all', True))
        chosen = attrs.get('barangays')
        if not all_ and chosen is not None and not chosen:
            raise serializers.ValidationError({'barangays': 'Choose the barangays this deadline applies to, or apply it to all.'})
        return attrs

    def validate_note(self, v):
        return bleach.clean(v, tags=[], strip=True)[:200]


class DeadlineViewSet(viewsets.ModelViewSet):
    serializer_class = DeadlineSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]
    pagination_class = None

    def get_queryset(self):
        qs = SKDeadline.objects.prefetch_related('barangays')
        year = self.request.query_params.get('year')
        return qs.filter(year=year) if year and year.isdigit() else qs

    def perform_create(self, serializer):
        obj = serializer.save(created_by=self.request.user)
        _audit(self.request, 'sk_deadline_set', obj, code=obj.code, year=obj.year, deadline=str(obj.deadline))

    def perform_update(self, serializer):
        obj = serializer.save()
        _audit(self.request, 'sk_deadline_changed', obj, code=obj.code, year=obj.year, deadline=str(obj.deadline), active=obj.is_active)

    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        _audit(request, 'sk_deadline_removed', obj, code=obj.code, year=obj.year, deadline=str(obj.deadline))
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
