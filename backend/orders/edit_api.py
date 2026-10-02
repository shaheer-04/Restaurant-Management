from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from .models import Order, OrderItem, OrderChange
from .permissions import CanAccessOrders
from .serializers import OrderSerializer

class ItemEditInput(serializers.Serializer):
    quantity = serializers.IntegerField(min_value=1, max_value=999, required=False)
    notes = serializers.CharField(max_length=500, allow_blank=True, required=False)
    cancel = serializers.BooleanField(default=False)
    reason = serializers.CharField(max_length=500, required=False, allow_blank=True)
    def validate(self, attrs):
        if attrs["cancel"] and not attrs.get("reason", "").strip():
            raise serializers.ValidationError("A cancellation reason is required.")
        if attrs["cancel"] and ("quantity" in attrs or "notes" in attrs):
            raise serializers.ValidationError("Cancel or edit an item, not both.")
        if not attrs["cancel"] and not ({"quantity", "notes"} & attrs.keys()):
            raise serializers.ValidationError("Supply quantity or notes.")
        return attrs

class ItemEditView(APIView):
    permission_classes = [CanAccessOrders]
    @transaction.atomic
    def patch(self, request, order_id, item_id):
        s = ItemEditInput(data=request.data); s.is_valid(raise_exception=True)
        order = get_object_or_404(Order.objects.select_for_update(), pk=order_id)
        if order.status != Order.Status.PENDING:
            raise ValidationError("Only pending orders can be edited.")
        item = get_object_or_404(OrderItem, pk=item_id, order=order)
        if item.is_cancelled:
            raise ValidationError("Item is already cancelled.")
        before = {"quantity": item.quantity, "notes": item.notes}
        data = s.validated_data
        if data["cancel"]:
            if order.items.filter(is_cancelled=False).count() <= 1:
                raise ValidationError("Cancel the whole order instead of its last item.")
            item.is_cancelled = True
        else:
            item.quantity = data.get("quantity", item.quantity)
            item.notes = data.get("notes", item.notes)
        item.save()
        OrderChange.objects.create(order=order, actor=request.user, action="cancel_item" if data["cancel"] else "edit_item", detail={"item_id": item.pk, "before": before, "after": data})
        return Response(OrderSerializer(order).data)

class OrderNotesView(APIView):
    permission_classes = [CanAccessOrders]
    @transaction.atomic
    def patch(self, request, order_id):
        class Input(serializers.Serializer):
            notes = serializers.CharField(max_length=500, allow_blank=True)
        s = Input(data=request.data); s.is_valid(raise_exception=True)
        order = get_object_or_404(Order.objects.select_for_update(), pk=order_id)
        if order.status != Order.Status.PENDING:
            raise ValidationError("Only pending orders can be edited.")
        before = order.notes
        order.notes = s.validated_data["notes"]; order.save(update_fields=["notes"])
        OrderChange.objects.create(order=order, actor=request.user, action="edit_notes", detail={"before": before, "after": order.notes})
        return Response(OrderSerializer(order).data)


class OrderHistoryView(APIView):
    permission_classes = [CanAccessOrders]
    def get(self, request, order_id):
        order = get_object_or_404(Order, pk=order_id)
        return Response(list(order.changes.values("id", "actor_id", "action", "detail", "created_at")))
