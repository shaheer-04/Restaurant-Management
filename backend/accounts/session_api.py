from django.contrib.auth import authenticate, login, logout
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.cache import never_cache
from rest_framework import serializers
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

def user_data(user):
    return {"id": user.pk, "username": user.username, "email": user.email, "roles": list(user.groups.values_list("name", flat=True)), "is_superuser": user.is_superuser}

@method_decorator(never_cache, name="dispatch")
class CSRFView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    def get(self, request):
        return Response({"csrfToken": get_token(request)})

@method_decorator(csrf_protect, name="dispatch")
@method_decorator(never_cache, name="dispatch")
class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"
    def post(self, request):
        class Input(serializers.Serializer):
            username = serializers.CharField(max_length=150)
            password = serializers.CharField(max_length=256, trim_whitespace=False)
        s = Input(data=request.data); s.is_valid(raise_exception=True)
        user = authenticate(request=request, **s.validated_data)
        if user is None:
            return Response({"detail": "Invalid username or password."}, status=400)
        login(request, user)
        return Response({"user": user_data(user), "csrfToken": get_token(request)})

class LogoutView(APIView):
    def post(self, request):
        logout(request)
        return Response({"detail": "Logged out."})
