from decimal import Decimal
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from .models import DailyRegister, Expense
from .report_services import daily_register_summary


def today():
    return timezone.localdate(timezone=timezone.get_default_timezone())


def lock_open_register(day):
    # Every payment/expense mutation and closing locks this same row.
    register = DailyRegister.objects.select_for_update().filter(business_date=day).first()
    if register is None:
        raise ValidationError({"register": "Open a register for this date first."})
    if register.is_closed:
        raise ValidationError({"register": "This date is closed; new entries and corrections are blocked."})
    return register


@transaction.atomic
def open_register(*, day, opening_cash, user):
    if day > today():
        raise ValidationError({"business_date": "Future registers are not allowed."})
    if day != today() and not (user.is_superuser or user.groups.filter(name="Manager").exists()):
        raise ValidationError({"business_date": "Only a manager may open a historical register."})
    register, created = DailyRegister.objects.get_or_create(business_date=day, defaults={"opening_cash": opening_cash, "opened_by": user})
    if not created and (register.is_closed or register.opening_cash != opening_cash):
        raise ValidationError({"register": "A register already exists with different details or is closed."})
    return register, created


@transaction.atomic
def close_register(*, pk, counted_cash, notes, user):
    register = get_object_or_404(DailyRegister.objects.select_for_update(), pk=pk)
    if register.is_closed:
        if register.counted_cash == counted_cash and register.closing_notes == notes:
            return register
        raise ValidationError({"register": "This register is already closed."})
    summary = daily_register_summary(report_date=register.business_date)
    register.cash_sales = Decimal(summary["cash_movement"]["cash_collected_from_sales"])
    register.cash_expenses = Decimal(summary["cash_movement"]["cash_expenses"])
    expected = register.opening_cash + register.cash_sales - register.cash_expenses
    if counted_cash != expected and not notes.strip():
        raise ValidationError({"closing_notes": "Explain the cash difference."})
    register.counted_cash = counted_cash
    register.closing_notes = notes
    register.closed_by = user
    register.closed_at = timezone.now()
    register.closing_snapshot = summary
    register.save()
    return register


@transaction.atomic
def record_expense(*, data, user):
    day = data.get("expense_date", today())
    lock_open_register(day)
    return Expense.objects.create(**{**data, "expense_date": day}, recorded_by=user)


@transaction.atomic
def void_expense(*, pk, reason, user):
    original = get_object_or_404(Expense, pk=pk)
    lock_open_register(original.expense_date)
    expense = Expense.objects.select_for_update().get(pk=pk)
    if expense.voided_at is not None:
        if expense.void_reason == reason:
            return expense
        raise ValidationError("Expense already voided.")
    expense.voided_at = timezone.now()
    expense.voided_by = user
    expense.void_reason = reason
    expense.save(update_fields=["voided_at", "voided_by", "void_reason"])
    return expense
