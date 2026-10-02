from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from accounts.permissions import IsManager

from .models import DiningTable, Order
from .order_actions import cancel_order
from .permissions import (
    CanAccessKitchen,
    CanAccessOrders,
    CanAccessTables,
)
from .serializers import (
    DiningTableSerializer,
    KitchenTicketSerializer,
    OrderCreateSerializer,
    OrderSerializer,
)
from .services import (
    advance_kitchen_status,
    send_order_to_kitchen,
)


class DiningTableViewSet(viewsets.ModelViewSet):
    serializer_class = DiningTableSerializer
    permission_classes = [CanAccessTables]

    http_method_names = [
        "get",
        "post",
        "put",
        "patch",
        "head",
        "options",
    ]

    def get_queryset(self):
        queryset = DiningTable.objects.prefetch_related("orders")

        if IsManager().has_permission(self.request, self):
            return queryset

        return queryset.filter(is_active=True)


class OrderViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [CanAccessOrders]

    http_method_names = [
        "get",
        "post",
        "head",
        "options",
    ]

    lookup_value_regex = r"\d+"

    queryset = (
        Order.objects
        .select_related("table", "created_by")
        .prefetch_related("items")
    )

    def get_queryset(self):
        qs = super().get_queryset()
        status = self.request.query_params.get("status")
        if status:
            from rest_framework.exceptions import ValidationError
            if status not in Order.Status.values:
                raise ValidationError({"status": "Invalid order status."})
            qs = qs.filter(status=status)
        return qs

    def get_serializer_class(self):
        if self.action == "create":
            return OrderCreateSerializer

        return OrderSerializer

    @action(
        detail=True,
        methods=["post"],
        url_path="send-to-kitchen",
    )
    def send_to_kitchen(self, request, pk=None):
        existing_order = self.get_object()

        order = send_order_to_kitchen(
            order_id=existing_order.pk
        )

        serializer = OrderSerializer(
            order,
            context=self.get_serializer_context(),
        )

        return Response(serializer.data)

    @action(
        detail=True,
        methods=["post"],
        url_path="cancel",
    )
    def cancel(self, request, pk=None):
        existing_order = self.get_object()

        order = cancel_order(
            user=request.user,
            order_id=existing_order.pk
        )

        serializer = OrderSerializer(
            order,
            context=self.get_serializer_context(),
        )

        return Response(serializer.data)


class KitchenTicketViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = KitchenTicketSerializer
    permission_classes = [CanAccessKitchen]

    http_method_names = [
        "get",
        "post",
        "head",
        "options",
    ]

    lookup_value_regex = r"\d+"

    def get_queryset(self):
        return (
            Order.objects
            .filter(
                sent_to_kitchen_at__isnull=False,
                status__in=[
                    Order.Status.PENDING,
                    Order.Status.PREPARING,
                    Order.Status.READY,
                ],
            )
            .select_related("table")
            .prefetch_related("items")
            .order_by("sent_to_kitchen_at", "id")
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="start-preparing",
    )
    def start_preparing(self, request, pk=None):
        existing_order = self.get_object()

        order = advance_kitchen_status(
            order_id=existing_order.pk,
            target_status=Order.Status.PREPARING,
        )

        return Response(
            self.get_serializer(order).data
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="mark-ready",
    )
    def mark_ready(self, request, pk=None):
        existing_order = self.get_object()

        order = advance_kitchen_status(
            order_id=existing_order.pk,
            target_status=Order.Status.READY,
        )

        return Response(
            self.get_serializer(order).data
        )