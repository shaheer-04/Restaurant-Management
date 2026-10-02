from django.urls import path

from .report_views import DailyRegisterSummaryView
from .views import ExpenseDetailView, ExpenseListCreateView


urlpatterns = [
    path(
        "daily-register/",
        DailyRegisterSummaryView.as_view(),
        name="daily-register-summary",
    ),
    path(
        "expenses/",
        ExpenseListCreateView.as_view(),
        name="expense-list-create",
    ),
    path(
        "expenses/<int:pk>/",
        ExpenseDetailView.as_view(),
        name="expense-detail",
    ),
]
from rest_framework.routers import SimpleRouter
from .register_api import RegisterViewSet, VoidExpenseView
router = SimpleRouter()
router.register("registers", RegisterViewSet, basename="register")
urlpatterns += router.urls
urlpatterns += [path("expenses/<int:pk>/void/", VoidExpenseView.as_view(), name="expense-void")]

from .dashboard_api import DashboardView
urlpatterns += [path("dashboard/", DashboardView.as_view())]
