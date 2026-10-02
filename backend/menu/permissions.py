from rest_framework.permissions import BasePermission, SAFE_METHODS

from accounts.permissions import IsManager


class CanAccessMenu(BasePermission):
    message = "You do not have permission to perform this menu action."

    def has_permission(self, request, view):
        if IsManager().has_permission(request, view):
            return True

        user = request.user

        return bool(
            user.is_authenticated
            and user.is_active
            and request.method in SAFE_METHODS
            and user.groups.filter(name="Cashier").exists()
        )