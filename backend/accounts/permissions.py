from rest_framework.permissions import BasePermission


class IsManager(BasePermission):
    message = "Only managers can access this endpoint."

    def has_permission(self, request, view):
        user = request.user

        if not user.is_authenticated or not user.is_active:
            return False

        if user.is_superuser:
            return True

        return user.groups.filter(name="Manager").exists()