from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import ValidationError

from menu.models import MenuItem

from .models import Order, OrderItem


@transaction.atomic
def add_order_items(*, order_id, items, user=None):
    order = get_object_or_404(
        Order.objects.select_for_update(),
        pk=order_id,
    )

    if order.status != Order.Status.PENDING:
        raise ValidationError({
            "status": (
                "Items can only be added while the order is pending."
            )
        })

    existing_count = order.items.count()

    if existing_count + len(items) > 100:
        raise ValidationError({
            "items": "An order cannot contain more than 100 item lines."
        })

    requested_ids = {
        row["menu_item_id"]
        for row in items
    }

    menu_items = {
        item.pk: item
        for item in (
            MenuItem.objects
            .select_related("category")
            .select_for_update(of=("self",))
            .filter(pk__in=requested_ids)
            .order_by("pk")
        )
    }

    missing_ids = requested_ids - set(menu_items)

    if missing_ids:
        raise ValidationError({
            "items": (
                f"Unknown menu item IDs: {sorted(missing_ids)}"
            )
        })

    for menu_item in menu_items.values():
        if (
            not menu_item.is_available
            or not menu_item.category.is_active
        ):
            raise ValidationError({
                "items": (
                    f"{menu_item.name} is currently unavailable."
                )
            })

    new_order_items = []

    for row in items:
        menu_item = menu_items[row["menu_item_id"]]

        new_order_items.append(
            OrderItem(
                order=order,
                menu_item=menu_item,
                item_name=menu_item.name,
                unit_price=menu_item.price,
                quantity=row["quantity"],
                notes=row.get("notes", ""),
            )
        )

    OrderItem.objects.bulk_create(new_order_items)

    if user is not None:
        from .models import OrderChange
        OrderChange.objects.create(order=order, actor=user, action="add_items", detail={"items": items})
    return order