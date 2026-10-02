from datetime import date

from rest_framework import serializers


class DailySalesQuerySerializer(serializers.Serializer):
    date = serializers.DateField(
        required=False,
        input_formats=["%Y-%m-%d"],
    )

    def validate_date(self, value):
        # Leave room to calculate the following day's midnight.
        if value == date.max:
            raise serializers.ValidationError(
                "Please select an earlier date."
            )
        return value