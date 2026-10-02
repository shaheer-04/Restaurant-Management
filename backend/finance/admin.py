from django.contrib import admin

from .models import DailyRegister


@admin.register(DailyRegister)
class DailyRegisterAdmin(admin.ModelAdmin):
    list_display = [
        "business_date",
        "opening_cash",
        "is_closed",
        "expected_cash",
        "counted_cash",
        "difference",
    ]

    list_filter = ["business_date"]

    readonly_fields = [
        "business_date",
        "opening_cash",
        "opened_by",
        "opened_at",
        "cash_sales",
        "cash_expenses",
        "expected_cash",
        "counted_cash",
        "difference",
        "closing_notes",
        "closed_by",
        "closed_at",
    ]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

from .models import Expense
@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ["id", "expense_date", "description", "amount", "payment_method", "voided_at"]
    readonly_fields = [f.name for f in Expense._meta.fields]
    def has_add_permission(self, request): return False
    def has_change_permission(self, request, obj=None): return False
    def has_delete_permission(self, request, obj=None): return False
