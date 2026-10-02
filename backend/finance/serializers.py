from django.utils import timezone
from rest_framework import serializers

from .models import Expense


class ExpenseSerializer(serializers.ModelSerializer):
    recorded_by_username = serializers.CharField(
        source="recorded_by.username",
        read_only=True,
    )

    class Meta:
        model = Expense

        fields = [
            "voided_at", "voided_by", "void_reason",
            "id",
            "description",
            "category",
            "amount",
            "payment_method",
            "expense_date",
            "notes",
            "recorded_by",
            "recorded_by_username",
            "created_at",
        ]

        read_only_fields = [
            "voided_at", "voided_by", "void_reason",
            "id",
            "recorded_by",
            "recorded_by_username",
            "created_at",
        ]

    def validate_expense_date(self, value):
        today = timezone.localdate(
            timezone=timezone.get_default_timezone()
        )

        if value > today:
            raise serializers.ValidationError(
                "An expense cannot be recorded for a future date."
            )

        return value


class ExpenseFilterSerializer(serializers.Serializer):
    date = serializers.DateField(
        required=False,
        input_formats=["%Y-%m-%d"],
    )