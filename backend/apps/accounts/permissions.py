from rest_framework.permissions import BasePermission
from .models import User


class IsYouth(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == User.Role.YOUTH


class IsLGUAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == User.Role.LGU_ADMIN


class IsSuperAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == User.Role.SUPER_ADMIN


class IsAdminOrLGU(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in (
            User.Role.LGU_ADMIN, User.Role.SUPER_ADMIN
        )


class IsAdminRole(BasePermission):
    """LGU Admin or Super Admin."""
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in (
            User.Role.LGU_ADMIN, User.Role.SUPER_ADMIN
        )
