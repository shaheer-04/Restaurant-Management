from django.db import transaction
from django.shortcuts import get_object_or_404

from rest_framework.exceptions import ValidationError
from rest_framework.generics import GenericAPIView
from rest_framework.response import Response

from orders.models import Order
from orders.permissions import CanAccessOrders

from .calculations import calculate_bill
from .serializers import (
    BillQuoteRequestSerializer,
    BillQuoteSerializer,
)


class BillQuoteView(GenericAPIView):
    serializer_class = BillQuoteRequestSerializer
    permission_classes = [CanAccessOrders]

    http_method_names = [
        "post",
        "options",
    ]

    def post(self, request, order_id):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            order = get_object_or_404(
                Order.objects.select_for_update(),
                pk=order_id,
            )

            if order.status in [
                Order.Status.CANCELLED,
                Order.Status.COMPLETED,
            ]:
                raise ValidationError({
                    "status": (
                        "Bill previews are available only for open orders."
                    )
                })

            bill = calculate_bill(
                subtotal=order.subtotal,
                **serializer.validated_data,
            )

            result = {
                "order_id": order.pk,
                "order_status": order.status,
                "currency": "PKR",
                **bill,
            }

            response_data = BillQuoteSerializer(result).data

        return Response(response_data)