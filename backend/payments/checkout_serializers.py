from decimal import Decimal

from rest_framework import serializers

from .models import Payment
from .serializers import BillQuoteRequestSerializer


class CheckoutRequestSerializer(BillQuoteRequestSerializer):
    method = serializers.ChoiceField(
        choices=Payment.Method.choices,
    )

    amount_received = serializers.DecimalField(
        max_digits=20,
        decimal_places=2,
        min_value=Decimal("0.00"),
    )


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment

        fields = [
            "id",
            "order",
            "method",
            "currency",
            "subtotal",
            "discount_type",
            "discount_value",
            "discount_amount",
            "taxable_amount",
            "tax_rate",
            "tax_amount",
            "total",
            "amount_received",
            "change_due",
            "recorded_by",
            "created_at",
        ]

        read_only_fields = fields