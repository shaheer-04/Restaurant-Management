from django.shortcuts import get_object_or_404
from rest_framework.renderers import TemplateHTMLRenderer
from rest_framework.response import Response
from rest_framework.views import APIView

from orders.permissions import CanAccessOrders

from .models import Payment


class PaymentReceiptView(APIView):
    permission_classes = [CanAccessOrders]
    renderer_classes = [TemplateHTMLRenderer]
    http_method_names = ["get", "head", "options"]

    def get(self, request, order_id):
        payment = get_object_or_404(
            Payment.objects.select_related(
                "order",
                "order__table",
                "recorded_by",
            ).prefetch_related("order__items"),
            order_id=order_id,
        )

        response = Response(
            {
                "payment": payment,
                "order": payment.order,
                "items": payment.order.active_items,
            },
            template_name="payments/receipt.html",
        )

        response["Cache-Control"] = "no-store"
        return response