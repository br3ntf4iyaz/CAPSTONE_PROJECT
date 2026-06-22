from django.utils import timezone
from rest_framework import filters, status, viewsets
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.response import Response

from apps.accounts.permissions import IsAdminRole

from .models import FAQ, SupportTicket, UserFeedback
from .serializers import FAQSerializer, SupportTicketSerializer, UserFeedbackSerializer


class SupportTicketViewSet(viewsets.ModelViewSet):
    """
    User    – create and list/retrieve their own tickets
    Admin   – list all tickets (filterable by status/priority/assigned_to), update status/assign
    """

    serializer_class = SupportTicketSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['subject', 'message', 'name', 'email']
    ordering_fields = ['created_at', 'priority', 'status']
    ordering = ['-created_at']

    def get_queryset(self):
        user = self.request.user
        role = getattr(user, 'role', None)

        if role in ('lgu_admin', 'super_admin'):
            qs = SupportTicket.objects.select_related('user', 'assigned_to').all()

            ticket_status = self.request.query_params.get('status')
            if ticket_status:
                qs = qs.filter(status=ticket_status)

            priority = self.request.query_params.get('priority')
            if priority:
                qs = qs.filter(priority=priority)

            assigned_to = self.request.query_params.get('assigned_to')
            if assigned_to:
                qs = qs.filter(assigned_to_id=assigned_to)

            unassigned = self.request.query_params.get('unassigned')
            if unassigned in ('true', '1'):
                qs = qs.filter(assigned_to__isnull=True)

            return qs

        # Regular user – see own tickets only
        return SupportTicket.objects.filter(user=user).select_related('assigned_to')

    def get_permissions(self):
        if self.action in ('destroy',):
            return [IsAuthenticated(), IsAdminRole()]
        if self.action in ('update', 'partial_update'):
            # Admins can update any; users cannot update their tickets (read-only after creation)
            return [IsAuthenticated(), IsAdminRole()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(user=user)

    def partial_update(self, request, *args, **kwargs):
        """
        Admins can update status, priority, and assigned_to.
        Auto-sets resolved_at when status flips to 'resolved'.
        """
        instance = self.get_object()
        new_status = request.data.get('status')
        resolved_at = None
        if new_status == 'resolved' and instance.status != 'resolved':
            resolved_at = timezone.now()

        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        save_kwargs = {}
        if resolved_at:
            save_kwargs['resolved_at'] = resolved_at

        serializer.save(**save_kwargs)
        return Response(serializer.data)


class FAQViewSet(viewsets.ModelViewSet):
    """
    list/retrieve – published FAQs for any visitor; admin sees all
    CRUD          – admin only
    """

    serializer_class = FAQSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['question', 'answer', 'category']
    ordering_fields = ['order', 'created_at']
    ordering = ['order', 'created_at']

    def get_queryset(self):
        user = self.request.user
        role = getattr(user, 'role', None) if user.is_authenticated else None

        if role in ('lgu_admin', 'super_admin'):
            qs = FAQ.objects.all()
        else:
            qs = FAQ.objects.filter(is_published=True)

        category = self.request.query_params.get('category')
        if category:
            qs = qs.filter(category__icontains=category)

        return qs

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAuthenticated(), IsAdminRole()]
        return [IsAuthenticatedOrReadOnly()]


class UserFeedbackViewSet(viewsets.ModelViewSet):
    """
    create – authenticated users submit feedback
    list/retrieve – admin only
    update/destroy – admin only
    """

    serializer_class = UserFeedbackSerializer
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['submitted_at', 'rating']
    ordering = ['-submitted_at']

    def get_queryset(self):
        user = self.request.user
        role = getattr(user, 'role', None)

        if role in ('lgu_admin', 'super_admin'):
            qs = UserFeedback.objects.select_related('user').all()

            # Filter by rating
            rating = self.request.query_params.get('rating')
            if rating:
                qs = qs.filter(rating=rating)

            # Filter by page
            page = self.request.query_params.get('page')
            if page:
                qs = qs.filter(page__icontains=page)

            return qs

        # Non-admins see only their own feedback
        return UserFeedback.objects.filter(user=user)

    def get_permissions(self):
        if self.action == 'create':
            return [IsAuthenticated()]
        if self.action in ('list', 'retrieve', 'update', 'partial_update', 'destroy'):
            return [IsAuthenticated(), IsAdminRole()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(user=user)
