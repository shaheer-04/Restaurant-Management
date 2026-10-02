from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone


class Expense(models.Model):
    class Category(models.TextChoices):
        INGREDIENTS = "ingredients", "Ingredients"
        PACKAGING = "packaging", "Packaging"
        UTILITIES = "utilities", "Utilities"
        RENT = "rent", "Rent"
        SALARIES = "salaries", "Salaries"
        MAINTENANCE = "maintenance", "Maintenance"
        OTHER = "other", "Other"

    class PaymentMethod(models.TextChoices):
        CASH = "cash", "Cash"
        CARD = "card", "Card"
        WALLET = "wallet", "Digital Wallet"

    voided_at = models.DateTimeField(null=True, blank=True)
    voided_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="voided_expenses")
    void_reason = models.CharField(max_length=500, blank=True)
    description = models.CharField(max_length=255)

    category = models.CharField(
        max_length=20,
        choices=Category.choices,
    )

    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )

    payment_method = models.CharField(
        max_length=10,
        choices=PaymentMethod.choices,
    )

    expense_date = models.DateField(
        default=timezone.localdate,
        db_index=True,
    )

    notes = models.CharField(
        max_length=500,
        blank=True,
    )

    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="recorded_expenses",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-expense_date", "-id"]

        constraints = [
            models.CheckConstraint(
                condition=models.Q(amount__gt=0),
                name="expense_amount_positive",
            ),
            models.CheckConstraint(
                condition=models.Q(
                    payment_method__in=["cash", "card", "wallet"]
                ),
                name="expense_payment_method_valid",
            ),
            models.CheckConstraint(
                condition=models.Q(
                    category__in=[
                        "ingredients",
                        "packaging",
                        "utilities",
                        "rent",
                        "salaries",
                        "maintenance",
                        "other",
                    ]
                ),
                name="expense_category_valid",
            ),
        ]

    def __str__(self):
        return f"{self.description} — PKR {self.amount}"



class DailyRegister(models.Model):
    closing_snapshot = models.JSONField(default=dict, blank=True)
    business_date = models.DateField(unique=True)

    opening_cash = models.DecimalField(
        max_digits=20,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )

    opened_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="opened_registers",
    )

    opened_at = models.DateTimeField(auto_now_add=True)

    cash_sales = models.DecimalField(
        max_digits=20,
        decimal_places=2,
        null=True,
        blank=True,
    )

    cash_expenses = models.DecimalField(
        max_digits=20,
        decimal_places=2,
        null=True,
        blank=True,
    )

    counted_cash = models.DecimalField(
        max_digits=20,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("0.00"))],
    )

    closing_notes = models.CharField(
        max_length=500,
        blank=True,
    )

    closed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="closed_registers",
        null=True,
        blank=True,
    )

    closed_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["-business_date"]

        constraints = [
            models.CheckConstraint(
                condition=models.Q(opening_cash__gte=0),
                name="register_opening_nonnegative",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(cash_sales__isnull=True)
                    | models.Q(cash_sales__gte=0)
                ),
                name="register_sales_nonnegative",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(cash_expenses__isnull=True)
                    | models.Q(cash_expenses__gte=0)
                ),
                name="register_expenses_nonnegative",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(counted_cash__isnull=True)
                    | models.Q(counted_cash__gte=0)
                ),
                name="register_counted_nonnegative",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(
                        closed_at__isnull=True,
                        closed_by__isnull=True,
                        cash_sales__isnull=True,
                        cash_expenses__isnull=True,
                        counted_cash__isnull=True,
                    )
                    | models.Q(
                        closed_at__isnull=False,
                        closed_by__isnull=False,
                        cash_sales__isnull=False,
                        cash_expenses__isnull=False,
                        counted_cash__isnull=False,
                    )
                ),
                name="register_closing_complete",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(closed_at__isnull=True)
                    | models.Q(
                        closed_at__gte=models.F("opened_at")
                    )
                ),
                name="register_closing_after_opening",
            ),
        ]

    @property
    def is_closed(self):
        return self.closed_at is not None

    @property
    def expected_cash(self):
        if not self.is_closed:
            return None

        return (
            self.opening_cash
            + self.cash_sales
            - self.cash_expenses
        )

    @property
    def difference(self):
        if not self.is_closed:
            return None

        return self.counted_cash - self.expected_cash

    def __str__(self):
        state = "Closed" if self.is_closed else "Open"
        return f"Register {self.business_date} — {state}"   
