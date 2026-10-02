from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .permissions import IsManager


@api_view(["GET"])
def current_user(request):
    user = request.user

    return Response({
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "roles": list(
            user.groups.order_by("name").values_list(
                "name", flat=True
            )
        ),
        "is_superuser": user.is_superuser,
    })


@api_view(["GET"])
@permission_classes([IsManager])
def manager_check(request):
    return Response({
        "message": "Manager access granted.",
        "username": request.user.username,
    })
