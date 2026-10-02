from datetime import datetime, time, timedelta
from decimal import Decimal

from django.db.models import Count, Sum
from django.utils import timezone

from .models import Payment


ZERO = Decimal("0.00")


def daily_sales_summary(*, report_date):
    restaurant_timezone = timezone.get_default_timezone()

    start = timezone.make_aware(
        datetime.combine(report_date, time.min),
        restaurant_timezone,
    )

    end = timezone.make_aware(
        datetime.combine(
            report_date + timedelta(days=1),
            time.min,
        ),
        restaurant_timezone,
    )

    # One grouped query provides all totals for this response.
    rows = list(
        Payment.objects.filter(
            created_at__gte=start,
            created_at__lt=end,
        )
        .order_by()
        .values("method")
        .annotate(
            payment_count=Count("id"),
            subtotal_sum=Sum("subtotal"),
            discount_sum=Sum("discount_amount"),
            net_sales_sum=Sum("taxable_amount"),
            tax_sum=Sum("tax_amount"),
            total_sum=Sum("total"),
            received_sum=Sum("amount_received"),
            change_sum=Sum("change_due"),
        )
    )

    by_method = {
        row["method"]: row
        for row in rows
    }

    def sum_field(field):
        return sum(
            (row[field] for row in rows),
            ZERO,
        )

    methods = {}

    for method, label in Payment.Method.choices:
        row = by_method.get(method)

        methods[method] = {
            "label": label,
            "paid_orders": row["payment_count"] if row else 0,
            "total_collected": (
                f'{row["total_sum"]:.2f}'
                if row
                else "0.00"
            ),
        }

    cash = by_method.get(Payment.Method.CASH)

    return {
        "date": report_date.isoformat(),
        "timezone": str(restaurant_timezone),
        "currency": "PKR",
        "paid_orders": sum(
            row["payment_count"] for row in rows
        ),
        "sales_before_discount": (
            f'{sum_field("subtotal_sum"):.2f}'
        ),
        "discounts": f'{sum_field("discount_sum"):.2f}',
        "net_sales_before_tax": (
            f'{sum_field("net_sales_sum"):.2f}'
        ),
        "tax_collected": f'{sum_field("tax_sum"):.2f}',
        "total_collected": f'{sum_field("total_sum"):.2f}',
        "payment_methods": methods,
        "cash_tendered": (
            f'{cash["received_sum"]:.2f}'
            if cash
            else "0.00"
        ),
        "cash_change_returned": (
            f'{cash["change_sum"]:.2f}'
            if cash
            else "0.00"
        ),
        "cash_collected": (
            f'{cash["total_sum"]:.2f}'
            if cash
            else "0.00"
        ),
    }