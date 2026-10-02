from django.conf import settings
from django.db import models


class Payment(models.Model):
    class Method(models.TextChoices):
        CASH = "cash", "Cash"
        CARD = "card", "Card"
        WALLET = "wallet", "Digital Wallet"

    class DiscountType(models.TextChoices):
        NONE = "none", "No Discount"
        FLAT = "flat", "Flat Discount"
        PERCENTAGE = "percentage", "Percentage Discount"

    order = models.OneToOneField(
        "orders.Order",
        on_delete=models.PROTECT,
        related_name="payment",
    )

    method = models.CharField(
        max_length=10,
        choices=Method.choices,
    )

    currency = models.CharField(
        max_length=3,
        default="PKR",
        editable=False,
    )

    subtotal = models.DecimalField(
        max_digits=20,
        decimal_places=2,
    )

    discount_type = models.CharField(
        max_length=10,
        choices=DiscountType.choices,
    )

    discount_value = models.DecimalField(
        max_digits=20,
        decimal_places=2,
    )

    discount_amount = models.DecimalField(
        max_digits=20,
        decimal_places=2,
    )

    taxable_amount = models.DecimalField(
        max_digits=20,
        decimal_places=2,
    )

    tax_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
    )

    tax_amount = models.DecimalField(
        max_digits=20,
        decimal_places=2,
    )

    total = models.DecimalField(
        max_digits=20,
        decimal_places=2,
    )

    amount_received = models.DecimalField(
        max_digits=20,
        decimal_places=2,
    )

    change_due = models.DecimalField(
        max_digits=20,
        decimal_places=2,
    )

    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="recorded_payments",
    )

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at", "-id"]

        constraints = [
            models.CheckConstraint(
                condition=models.Q(
                    method__in=["cash", "card", "wallet"]
                ),
                name="payment_method_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(currency="PKR"),
                name="payment_currency_valid",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(subtotal__gte=0)
                    & models.Q(discount_value__gte=0)
                    & models.Q(discount_amount__gte=0)
                    & models.Q(taxable_amount__gte=0)
                    & models.Q(tax_amount__gte=0)
                    & models.Q(total__gte=0)
                    & models.Q(amount_received__gte=0)
                    & models.Q(change_due__gte=0)
                ),
                name="payment_amounts_nonnegative",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(tax_rate__gte=0)
                    & models.Q(tax_rate__lte=100)
                ),
                name="payment_tax_rate_valid",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(
                        discount_type="none",
                        discount_value=0,
                        discount_amount=0,
                    )
                    | models.Q(
                        discount_type="flat",
                        discount_value=models.F("discount_amount"),
                    )
                    | models.Q(
                        discount_type="percentage",
                        discount_value__lte=100,
                    )
                ),
                name="payment_discount_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(
                    discount_amount__lte=models.F("subtotal")
                ),
                name="payment_discount_within_subtotal",
            ),
            models.CheckConstraint(
                condition=models.Q(
                    taxable_amount=(
                        models.F("subtotal")
                        - models.F("discount_amount")
                    )
                ),
                name="payment_taxable_amount_matches",
            ),
            models.CheckConstraint(
                condition=models.Q(
                    total=(
                        models.F("taxable_amount")
                        + models.F("tax_amount")
                    )
                ),
                name="payment_total_matches",
            ),
            models.CheckConstraint(
                condition=models.Q(
                    amount_received__gte=models.F("total")
                ),
                name="payment_received_covers_total",
            ),
            models.CheckConstraint(
                condition=models.Q(
                    change_due=(
                        models.F("amount_received")
                        - models.F("total")
                    )
                ),
                name="payment_change_matches",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(method="cash")
                    | models.Q(
                        amount_received=models.F("total"),
                        change_due=0,
                    )
                ),
                name="payment_noncash_exact",
            ),
        ]

    def __str__(self):
        return f"Payment #{self.pk} — Order #{self.order_id}"
