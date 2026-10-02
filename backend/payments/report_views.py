from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from orders.permissions import CanAccessOrders

from .report_serializers import DailySalesQuerySerializer
from .report_services import daily_sales_summary


class DailySalesSummaryView(APIView):
    permission_classes = [CanAccessOrders]
    http_method_names = ["get", "head", "options"]

    def get(self, request):
        serializer = DailySalesQuerySerializer(
            data=request.query_params,
        )
        serializer.is_valid(raise_exception=True)

        report_date = serializer.validated_data.get("date")

        if report_date is None:
            report_date = timezone.localdate(
                timezone=timezone.get_default_timezone()
            )

        response = Response(
            daily_sales_summary(report_date=report_date)
        )
        response["Cache-Control"] = "no-store"

        return response