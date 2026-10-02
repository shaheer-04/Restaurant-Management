from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from menu.models import MenuItem

from .models import DiningTable, Order, OrderItem


@transaction.atomic
def create_order(*, data, user):
    table = None

    if data["order_type"] == Order.OrderType.DINE_IN:
        table = (
            DiningTable.objects
            .select_for_update()
            .filter(pk=data["table_id"])
            .first()
        )

        if table is None:
            raise ValidationError({
                "table_id": "This table does not exist."
            })

        if not table.is_active:
            raise ValidationError({
                "table_id": "This table is inactive."
            })

        open_order_exists = Order.objects.filter(
            table=table,
            status__in=[
                Order.Status.PENDING,
                Order.Status.PREPARING,
                Order.Status.READY,
            ],
        ).exists()

        if open_order_exists:
            raise ValidationError({
                "table_id": "This table already has an open order."
            })

    requested_items = data["items"]

    item_ids = {
        row["menu_item_id"]
        for row in requested_items
    }

    menu_items = {
        item.pk: item
        for item in (
            MenuItem.objects
            .select_related("category")
            .select_for_update(of=("self",))
            .filter(pk__in=item_ids)
            .order_by("pk")
        )
    }

    missing_ids = item_ids - set(menu_items)

    if missing_ids:
        raise ValidationError({
            "items": (
                f"Unknown menu item IDs: {sorted(missing_ids)}"
            )
        })

    for item in menu_items.values():
        if not item.is_available or not item.category.is_active:
            raise ValidationError({
                "items": f"{item.name} is currently unavailable."
            })

    order = Order.objects.create(
        order_type=data["order_type"],
        table=table,
        notes=data.get("notes", ""),
        created_by=user,
    )

    order_items = []

    for row in requested_items:
        menu_item = menu_items[row["menu_item_id"]]

        order_items.append(
            OrderItem(
                order=order,
                menu_item=menu_item,
                item_name=menu_item.name,
                unit_price=menu_item.price,
                quantity=row["quantity"],
                notes=row.get("notes", ""),
            )
        )

    OrderItem.objects.bulk_create(order_items)

    return order


@transaction.atomic
def send_order_to_kitchen(*, order_id):
    order = (
        Order.objects
        .select_for_update()
        .get(pk=order_id)
    )

    if order.status in [
        Order.Status.COMPLETED,
        Order.Status.CANCELLED,
    ]:
        raise ValidationError({
            "status": "A closed order cannot be sent to the kitchen."
        })

    # Repeating submission must not create another ticket.
    if order.sent_to_kitchen_at is not None:
        return order

    if order.status != Order.Status.PENDING:
        raise ValidationError({
            "status": "Only pending orders can be submitted."
        })

    if not order.items.filter(is_cancelled=False).exists():
        raise ValidationError({
            "items": "An empty order cannot be sent to the kitchen."
        })

    order.sent_to_kitchen_at = timezone.now()

    order.save(
        update_fields=["sent_to_kitchen_at"]
    )

    return order


@transaction.atomic
def advance_kitchen_status(*, order_id, target_status):
    order = (
        Order.objects
        .select_for_update()
        .get(pk=order_id)
    )

    previous_status = {
        Order.Status.PREPARING: Order.Status.PENDING,
        Order.Status.READY: Order.Status.PREPARING,
    }

    if target_status not in previous_status:
        raise ValidationError({
            "status": "Unsupported kitchen status."
        })

    if order.sent_to_kitchen_at is None:
        raise ValidationError({
            "status": "This order has not been sent to the kitchen."
        })

    # Repeating the same successful action is harmless.
    if order.status == target_status:
        return order

    required_status = previous_status[target_status]

    if order.status != required_status:
        raise ValidationError({
            "status": (
                f"Cannot move from {order.status} "
                f"to {target_status}."
            )
        })

    order.status = target_status
    order.save(update_fields=["status"])

    return order