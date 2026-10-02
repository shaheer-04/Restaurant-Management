from decimal import Decimal, ROUND_HALF_UP

from django.conf import settings
from rest_framework.exceptions import ValidationError


CENT = Decimal("0.01")
ZERO = Decimal("0.00")
HUNDRED = Decimal("100.00")


def money(value):
    return value.quantize(
        CENT,
        rounding=ROUND_HALF_UP,
    )


def calculate_bill(
    *,
    subtotal,
    discount_type,
    discount_value,
):
    subtotal = money(subtotal)

    if discount_value < ZERO:
        raise ValidationError({
            "discount_value": "Discount cannot be negative."
        })

    if discount_type == "none":
        if discount_value != ZERO:
            raise ValidationError({
                "discount_value": (
                    "Discount value must be zero when type is none."
                )
            })

        discount_amount = ZERO

    elif discount_type == "flat":
        if discount_value > subtotal:
            raise ValidationError({
                "discount_value": (
                    "Flat discount cannot exceed the subtotal."
                )
            })

        discount_amount = money(discount_value)

    elif discount_type == "percentage":
        if discount_value > HUNDRED:
            raise ValidationError({
                "discount_value": (
                    "Percentage discount cannot exceed 100."
                )
            })

        discount_amount = money(
            subtotal * discount_value / HUNDRED
        )

    else:
        raise ValidationError({
            "discount_type": "Unsupported discount type."
        })

    taxable_amount = money(subtotal - discount_amount)
    tax_rate = settings.RESTAURANT_TAX_RATE

    tax_amount = money(
        taxable_amount * tax_rate / HUNDRED
    )

    total = money(taxable_amount + tax_amount)

    return {
        "subtotal": subtotal,
        "discount_type": discount_type,
        "discount_value": money(discount_value),
        "discount_amount": discount_amount,
        "taxable_amount": taxable_amount,
        "tax_rate": tax_rate,
        "tax_amount": tax_amount,
        "total": total,
    }