from django.db import transaction
from rest_framework.exceptions import ValidationError

from .models import Order


@transaction.atomic
def cancel_order(*, order_id, user=None):
    order = (
        Order.objects
        .select_for_update()
        .get(pk=order_id)
    )

    # Repeating a successful cancellation is harmless.
    if order.status == Order.Status.CANCELLED:
        return order

    if order.status != Order.Status.PENDING:
        raise ValidationError({
            "status": (
                "Only pending orders can be cancelled. "
                "Preparation may already have started."
            )
        })

    order.status = Order.Status.CANCELLED
    order.save(update_fields=["status"])
    if user is not None:
        from .models import OrderChange
        OrderChange.objects.create(order=order, actor=user, action="cancel_order", detail={})

    return order