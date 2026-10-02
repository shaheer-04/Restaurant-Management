from rest_framework.generics import (
    ListCreateAPIView,
    RetrieveAPIView,
)
from rest_framework.pagination import PageNumberPagination

from .models import Expense
from .permissions import CanAccessExpenses
from .serializers import (
    ExpenseFilterSerializer,
    ExpenseSerializer,
)


class ExpensePagination(PageNumberPagination):
    page_size = 50


class ExpenseListCreateView(ListCreateAPIView):
    serializer_class = ExpenseSerializer
    permission_classes = [CanAccessExpenses]
    pagination_class = ExpensePagination
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        queryset = Expense.objects.select_related("recorded_by")

        filters = ExpenseFilterSerializer(
            data=self.request.query_params
        )
        filters.is_valid(raise_exception=True)

        expense_date = filters.validated_data.get("date")

        if expense_date is not None:
            queryset = queryset.filter(
                expense_date=expense_date
            )

        return queryset

    def perform_create(self, serializer):
        from .register_services import record_expense
        serializer.instance = record_expense(data=serializer.validated_data, user=self.request.user)


class ExpenseDetailView(RetrieveAPIView):
    queryset = Expense.objects.select_related("recorded_by")
    serializer_class = ExpenseSerializer
    permission_classes = [CanAccessExpenses]
    http_method_names = ["get", "head", "options"]