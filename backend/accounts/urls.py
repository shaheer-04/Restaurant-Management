from django.urls import path

from .views import current_user, manager_check


urlpatterns = [
    path("me/", current_user, name="current-user"),
    path(
        "manager-check/",
        manager_check,
        name="manager-check",
    ),
]
from .session_api import CSRFView, LoginView, LogoutView
from .staff_api import StaffViewSet
from rest_framework.routers import SimpleRouter
router = SimpleRouter()
router.register("staff", StaffViewSet, basename="staff")
urlpatterns += router.urls
urlpatterns += [path("csrf/", CSRFView.as_view()), path("login/", LoginView.as_view()), path("logout/", LogoutView.as_view())]
