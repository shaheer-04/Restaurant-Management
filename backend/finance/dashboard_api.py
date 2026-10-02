from decimal import Decimal
from django.db.models import Count, F
from rest_framework.views import APIView
from rest_framework.response import Response
from accounts.permissions import IsManager
from orders.models import Order
from inventory.models import StockItem
from payments.report_serializers import DailySalesQuerySerializer
from .register_services import today
from .report_services import daily_register_summary

class DashboardView(APIView):
    permission_classes = [IsManager]
    def get(self, request):
        s = DailySalesQuerySerializer(data=request.query_params); s.is_valid(raise_exception=True)
        day = s.validated_data.get("date", today())
        report = daily_register_summary(report_date=day)
        operating_surplus = Decimal(report["sales"]["net_sales_before_tax"]) - Decimal(report["expenses"]["total"])
        return Response({"daily_report": report, "sales_less_recorded_expenses_before_tax": f"{operating_surplus:.2f}", "report_basis": "Recorded sales less expenses; excludes inventory valuation, depreciation, accruals, refunds and unrecorded costs. This is not accounting net profit.", "current_order_counts": list(Order.objects.order_by().values("status").annotate(count=Count("id"))), "low_stock": list(StockItem.objects.filter(is_active=True, quantity__lte=F("low_stock_threshold")).values("id", "name", "unit", "quantity", "low_stock_threshold"))})
