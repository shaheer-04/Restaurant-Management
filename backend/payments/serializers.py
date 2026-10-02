from decimal import Decimal

from rest_framework import serializers


class BillQuoteRequestSerializer(serializers.Serializer):
    discount_type = serializers.ChoiceField(
        choices=["none", "flat", "percentage"],
        default="none",
    )

    discount_value = serializers.DecimalField(
        max_digits=20,
        decimal_places=2,
        min_value=Decimal("0.00"),
        default=Decimal("0.00"),
    )


class BillQuoteSerializer(serializers.Serializer):
    order_id = serializers.IntegerField()
    order_status = serializers.CharField()
    currency = serializers.CharField()

    subtotal = serializers.DecimalField(
        max_digits=20,
        decimal_places=2,
    )

    discount_type = serializers.CharField()

    discount_value = serializers.DecimalField(
        max_digits=20,
        decimal_places=2,
    )

    discount_amount = serializers.DecimalField(
        max_digits=20,
        decimal_places=2,
    )

    taxable_amount = serializers.DecimalField(
        max_digits=20,
        decimal_places=2,
    )

    tax_rate = serializers.DecimalField(
        max_digits=5,
        decimal_places=2,
    )

    tax_amount = serializers.DecimalField(
        max_digits=20,
        decimal_places=2,
    )

    total = serializers.DecimalField(
        max_digits=20,
        decimal_places=2,
    )