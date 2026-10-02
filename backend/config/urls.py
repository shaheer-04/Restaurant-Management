from django.contrib import admin
from django.urls import include, path

from .views import health_check


urlpatterns = [
    path("api/inventory/", include("inventory.urls")),
    path("admin/", admin.site.urls),

    path(
        "api/health/",
        health_check,
        name="health-check",
    ),

    path("api/auth/", include("accounts.urls")),

    path("api-auth/", include("rest_framework.urls")),

    path("api/menu/", include("menu.urls")),

    path("api/orders/", include("orders.urls")),

    path("api/payments/", include("payments.urls")),

    path("api/finance/", include("finance.urls")),
]