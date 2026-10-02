from django.conf import settings
from django.db import models
class StockItem(models.Model):
    class Unit(models.TextChoices):
        KG = "kg", "Kilograms"
        LITERS = "liters", "Liters"
        UNITS = "units", "Units"
    name = models.CharField(max_length=150, unique=True)
    unit = models.CharField(max_length=10, choices=Unit.choices)
    quantity = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    low_stock_threshold = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    is_active = models.BooleanField(default=True)
    class Meta:
        ordering = ["name"]
        constraints = [
            models.CheckConstraint(condition=models.Q(quantity__gte=0), name="stock_nonnegative"),
            models.CheckConstraint(condition=models.Q(low_stock_threshold__gte=0), name="stock_threshold_nonnegative"),
            models.CheckConstraint(condition=models.Q(unit__in=["kg", "liters", "units"]), name="stock_unit_valid"),
        ]

class StockAdjustment(models.Model):
    item = models.ForeignKey(StockItem, on_delete=models.PROTECT, related_name="adjustments")
    delta = models.DecimalField(max_digits=12, decimal_places=3)
    balance_after = models.DecimalField(max_digits=12, decimal_places=3)
    reason = models.CharField(max_length=500)
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        ordering = ["-id"]
        constraints = [models.CheckConstraint(condition=models.Q(balance_after__gte=0), name="stock_balance_nonnegative")]
