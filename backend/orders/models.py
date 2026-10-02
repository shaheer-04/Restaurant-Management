from decimal import Decimal

from django.conf import settings
from django.core.validators import (
    MaxValueValidator,
    MinValueValidator,
)
from django.db import models


class DiningTable(models.Model):
    table_number = models.PositiveIntegerField(
        unique=True,
        validators=[MinValueValidator(1)],
    )

    capacity = models.PositiveSmallIntegerField(
        default=4,
        validators=[MinValueValidator(1)],
    )

    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["table_number"]

        constraints = [
            models.CheckConstraint(
                condition=models.Q(table_number__gte=1),
                name="dining_table_number_positive",
            ),
            models.CheckConstraint(
                condition=models.Q(capacity__gte=1),
                name="dining_table_capacity_positive",
            ),
        ]

    def __str__(self):
        return f"Table {self.table_number}"


class Order(models.Model):
    class OrderType(models.TextChoices):
        DINE_IN = "dine_in", "Dine-in"
        TAKEAWAY = "takeaway", "Takeaway"
        DELIVERY = "delivery", "Delivery"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PREPARING = "preparing", "Preparing"
        READY = "ready", "Ready"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    order_type = models.CharField(
        max_length=10,
        choices=OrderType.choices,
    )

    table = models.ForeignKey(
        DiningTable,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="orders",
    )

    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.PENDING,
    )

    notes = models.CharField(max_length=500, blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_orders",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    sent_to_kitchen_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["-created_at", "-id"]

        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(
                        order_type="dine_in",
                        table__isnull=False,
                    )
                    | models.Q(
                        order_type__in=["takeaway", "delivery"],
                        table__isnull=True,
                    )
                ),
                name="order_table_matches_type",
            ),
            models.UniqueConstraint(
                fields=["table"],
                condition=models.Q(
                    status__in=["pending", "preparing", "ready"],
                    table__isnull=False,
                ),
                name="one_open_order_per_table",
            ),
        ]

    @property
    def active_items(self):
        return [item for item in self.items.all() if not item.is_cancelled]

    @property
    def subtotal(self):
        return sum(
            (item.line_total for item in self.active_items),
            Decimal("0.00"),
        )

    def __str__(self):
        return f"Order #{self.pk}"


class OrderItem(models.Model):
    is_cancelled = models.BooleanField(default=False)
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name="items",
    )

    menu_item = models.ForeignKey(
        "menu.MenuItem",
        on_delete=models.PROTECT,
        related_name="order_items",
    )

    item_name = models.CharField(max_length=150)

    unit_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )

    quantity = models.PositiveIntegerField(
        validators=[
            MinValueValidator(1),
            MaxValueValidator(999),
        ],
    )

    notes = models.CharField(max_length=500, blank=True)

    class Meta:
        ordering = ["id"]

        constraints = [
            models.CheckConstraint(
                condition=models.Q(
                    quantity__gte=1,
                    quantity__lte=999,
                ),
                name="order_item_quantity_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(unit_price__gte=0),
                name="order_item_price_nonnegative",
            ),
        ]

    @property
    def line_total(self):
        return self.unit_price * self.quantity

    def __str__(self):
        return f"{self.quantity} × {self.item_name}"

class OrderChange(models.Model):
    order = models.ForeignKey(Order, on_delete=models.PROTECT, related_name="changes")
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    action = models.CharField(max_length=40)
    detail = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        ordering = ["id"]
