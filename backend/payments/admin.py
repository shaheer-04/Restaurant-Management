from django.contrib import admin

from .models import Payment


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "order",
        "method",
        "total",
        "recorded_by",
        "created_at",
    ]

    list_filter = [
        "method",
        "created_at",
    ]

    search_fields = [
        "recorded_by__username",
    ]

    list_select_related = [
        "order",
        "recorded_by",
    ]

    readonly_fields = [
        "id",
        "order",
        "method",
        "currency",
        "subtotal",
        "discount_type",
        "discount_value",
        "discount_amount",
        "taxable_amount",
        "tax_rate",
        "tax_amount",
        "total",
        "amount_received",
        "change_due",
        "recorded_by",
        "created_at",
    ]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False