from rest_framework import serializers

from .models import DiningTable, Order, OrderItem
from .services import create_order


class DiningTableSerializer(serializers.ModelSerializer):
    open_order_id = serializers.SerializerMethodField()
    def get_open_order_id(self, obj):
        return next((o.pk for o in obj.orders.all() if o.status in ["pending", "preparing", "ready"]), None)

    class Meta:
        model = DiningTable
        fields = [
            "id",
            "table_number",
            "open_order_id",
            "capacity",
            "is_active",
        ]
        read_only_fields = ["id"]


class OrderItemSerializer(serializers.ModelSerializer):
    line_total = serializers.DecimalField(
        max_digits=16,
        decimal_places=2,
        read_only=True,
    )

    class Meta:
        model = OrderItem
        fields = [
            "id",
            "menu_item",
            "item_name",
            "unit_price",
            "quantity",
            "notes",
            "line_total",
            "is_cancelled",
        ]
        read_only_fields = fields


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)

    subtotal = serializers.DecimalField(
        max_digits=20,
        decimal_places=2,
        read_only=True,
    )

    class Meta:
        model = Order
        fields = [
            "id",
            "order_type",
            "table",
            "status",
            "notes",
            "created_by",
            "created_at",
            "sent_to_kitchen_at",
            "items",
            "subtotal",
        ]
        read_only_fields = fields


class OrderLineInputSerializer(serializers.Serializer):
    menu_item_id = serializers.IntegerField(min_value=1)

    quantity = serializers.IntegerField(
        min_value=1,
        max_value=999,
    )

    notes = serializers.CharField(
        max_length=500,
        required=False,
        allow_blank=True,
        default="",
    )


class OrderCreateSerializer(serializers.Serializer):
    order_type = serializers.ChoiceField(
        choices=Order.OrderType.choices
    )

    table_id = serializers.IntegerField(
        min_value=1,
        required=False,
        allow_null=True,
        default=None,
    )

    notes = serializers.CharField(
        max_length=500,
        required=False,
        allow_blank=True,
        default="",
    )

    items = OrderLineInputSerializer(
        many=True,
        allow_empty=False,
        max_length=100,
    )

    def validate(self, attrs):
        order_type = attrs["order_type"]
        table_id = attrs["table_id"]

        if order_type == Order.OrderType.DINE_IN:
            if table_id is None:
                raise serializers.ValidationError({
                    "table_id": "A table is required for dine-in."
                })

        elif table_id is not None:
            raise serializers.ValidationError({
                "table_id": (
                    "Takeaway and delivery orders cannot have a table."
                )
            })

        return attrs

    def create(self, validated_data):
        return create_order(
            data=validated_data,
            user=self.context["request"].user,
        )

    def to_representation(self, instance):
        return OrderSerializer(
            instance,
            context=self.context,
        ).data


class KitchenOrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem

        fields = [
            "id",
            "item_name",
            "quantity",
            "notes",
        ]

        read_only_fields = fields


class KitchenTicketSerializer(serializers.ModelSerializer):
    table_number = serializers.IntegerField(
        source="table.table_number",
        read_only=True,
        allow_null=True,
    )

    items = KitchenOrderItemSerializer(
        source="active_items",
        many=True,
        read_only=True,
    )

    class Meta:
        model = Order

        fields = [
            "id",
            "order_type",
            "table_number",
            "status",
            "notes",
            "created_at",
            "sent_to_kitchen_at",
            "items",
        ]

        read_only_fields = fields