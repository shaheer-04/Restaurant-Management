from rest_framework import serializers

from .serializers import OrderLineInputSerializer


class AddOrderItemsSerializer(serializers.Serializer):
    items = OrderLineInputSerializer(
        many=True,
        allow_empty=False,
        max_length=100,
    )