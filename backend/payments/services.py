from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import ValidationError

from orders.models import Order

from .calculations import calculate_bill, money
from .models import Payment


@transaction.atomic
def checkout_order(*, order_id, data, user):
    order = get_object_or_404(
        Order.objects.select_for_update(),
        pk=order_id,
    )

    # A repeated request must not create another payment.
    existing_payment = Payment.objects.filter(
        order_id=order.pk,
    ).first()

    if existing_payment is not None:
        if order.status != Order.Status.COMPLETED:
            raise ValidationError({
                "detail": (
                    "This order already has a payment but is not "
                    "completed. Ask a manager to review it."
                )
            })

        matches_existing = (
            existing_payment.method == data["method"]
            and existing_payment.discount_type
            == data["discount_type"]
            and existing_payment.discount_value
            == data["discount_value"]
            and existing_payment.amount_received
            == data["amount_received"]
        )

        if not matches_existing:
            raise ValidationError({
                "detail": (
                    "This order has already been paid with "
                    "different payment details."
                )
            })

        return existing_payment, False

    if order.status != Order.Status.READY:
        raise ValidationError({
            "detail": "Only Ready orders can be checked out."
        })

    if order.sent_to_kitchen_at is None:
        raise ValidationError({
            "detail": "This order has not been sent to the kitchen."
        })

    if not order.items.filter(is_cancelled=False).exists():
        raise ValidationError({
            "detail": "An empty order cannot be checked out."
        })

    from finance.register_services import today, lock_open_register
    from django.utils import timezone
    day = today()
    lock_open_register(day)
    if today() != day:
        raise ValidationError("Date changed while waiting; retry checkout.")
    # Recalculate using saved order prices and server tax settings.
    bill = calculate_bill(
        subtotal=order.subtotal,
        discount_type=data["discount_type"],
        discount_value=data["discount_value"],
    )

    amount_received = data["amount_received"]
    total = bill["total"]

    if amount_received < total:
        raise ValidationError({
            "amount_received": (
                f"Amount received must be at least {total:.2f}."
            )
        })

    if (
        data["method"] != Payment.Method.CASH
        and amount_received != total
    ):
        raise ValidationError({
            "amount_received": (
                "Card and wallet payments must equal "
                f"the bill total: {total:.2f}."
            )
        })

    payment = Payment.objects.create(
        order=order,
        method=data["method"],
        currency="PKR",
        amount_received=amount_received,
        change_due=money(amount_received - total),
        recorded_by=user,
        **bill,
    )

    if timezone.localdate(payment.created_at, timezone.get_default_timezone()) != day:
        raise ValidationError("Date changed during checkout; retry.")
    order.status = Order.Status.COMPLETED
    order.save(update_fields=["status"])

    return payment, True