from rest_framework import status
from rest_framework.generics import GenericAPIView, RetrieveAPIView
from rest_framework.response import Response

from orders.permissions import CanAccessOrders

from .checkout_serializers import (
    CheckoutRequestSerializer,
    PaymentSerializer,
)
from .models import Payment
from .services import checkout_order


class CheckoutView(GenericAPIView):
    serializer_class = CheckoutRequestSerializer
    permission_classes = [CanAccessOrders]
    http_method_names = ["post", "options"]

    def post(self, request, order_id):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        payment, created = checkout_order(
            order_id=order_id,
            data=serializer.validated_data,
            user=request.user,
        )

        return Response(
            {
                "created": created,
                "order_status": "completed",
                "payment": PaymentSerializer(payment).data,
            },
            status=(
                status.HTTP_201_CREATED
                if created
                else status.HTTP_200_OK
            ),
        )


class OrderPaymentView(RetrieveAPIView):
    serializer_class = PaymentSerializer
    permission_classes = [CanAccessOrders]
    http_method_names = ["get", "head", "options"]

    queryset = Payment.objects.all()

    lookup_field = "order_id"
    lookup_url_kwarg = "order_id"