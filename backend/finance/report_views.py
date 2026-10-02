from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from payments.report_serializers import DailySalesQuerySerializer

from .permissions import CanAccessExpenses
from .report_services import daily_register_summary


class DailyRegisterSummaryView(APIView):
    permission_classes = [CanAccessExpenses]
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

        from .models import DailyRegister
        closed = DailyRegister.objects.filter(business_date=report_date, closed_at__isnull=False).first()
        response = Response(
            closed.closing_snapshot if closed else daily_register_summary(report_date=report_date)
        )

        response["Cache-Control"] = "no-store"

        return response