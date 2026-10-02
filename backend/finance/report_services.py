from decimal import Decimal

from django.db.models import Count, Sum

from payments.report_services import daily_sales_summary

from .models import Expense


ZERO = Decimal("0.00")


def daily_register_summary(*, report_date):
    sales = daily_sales_summary(report_date=report_date)

    expense_rows = list(
        Expense.objects.filter(
            expense_date=report_date,
            voided_at__isnull=True,
        )
        .order_by()
        .values("payment_method")
        .annotate(
            expense_count=Count("id"),
            amount_sum=Sum("amount"),
        )
    )

    rows_by_method = {
        row["payment_method"]: row
        for row in expense_rows
    }

    expenses_by_method = {}

    for method, label in Expense.PaymentMethod.choices:
        row = rows_by_method.get(method)

        expenses_by_method[method] = {
            "label": label,
            "count": row["expense_count"] if row else 0,
            "amount": (
                f'{row["amount_sum"]:.2f}'
                if row
                else "0.00"
            ),
        }

    total_expenses = sum(
        (row["amount_sum"] for row in expense_rows),
        ZERO,
    )

    cash_sales = Decimal(sales["cash_collected"])

    cash_expenses = Decimal(
        expenses_by_method["cash"]["amount"]
    )

    net_cash_movement = cash_sales - cash_expenses

    return {
        "date": report_date.isoformat(),
        "timezone": sales["timezone"],
        "currency": "PKR",
        "sales": sales,
        "expenses": {
            "count": sum(
                row["expense_count"]
                for row in expense_rows
            ),
            "total": f"{total_expenses:.2f}",
            "payment_methods": expenses_by_method,
        },
        "cash_movement": {
            "cash_collected_from_sales": f"{cash_sales:.2f}",
            "cash_expenses": f"{cash_expenses:.2f}",
            "net_cash_movement": f"{net_cash_movement:.2f}",
        },
    }