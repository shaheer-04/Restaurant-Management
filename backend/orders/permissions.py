from rest_framework.permissions import BasePermission, SAFE_METHODS

from accounts.permissions import IsManager


class CanAccessTables(BasePermission):
    message = "You do not have permission to perform this table action."

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


class CanAccessOrders(BasePermission):
    message = "Only managers and cashiers can access these orders."

    def has_permission(self, request, view):
        if IsManager().has_permission(request, view):
            return True

        user = request.user

        return bool(
            user.is_authenticated
            and user.is_active
            and user.groups.filter(name="Cashier").exists()
        )

class CanAccessKitchen(BasePermission):
    message = "Only managers and kitchen staff can access kitchen tickets."

    def has_permission(self, request, view):
        if IsManager().has_permission(request, view):
            return True

        user = request.user

        return bool(
            user.is_authenticated
            and user.is_active
            and user.groups.filter(name="Kitchen").exists()
        )