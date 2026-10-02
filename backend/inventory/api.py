from decimal import Decimal
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import serializers, viewsets, mixins
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from accounts.permissions import IsManager
from .models import StockItem, StockAdjustment

class StockSerializer(serializers.ModelSerializer):
    low_stock_threshold = serializers.DecimalField(max_digits=12, decimal_places=3, min_value=Decimal("0"), required=False)
    class Meta:
        model = StockItem
        fields = ["id", "name", "unit", "quantity", "low_stock_threshold", "is_active"]
        read_only_fields = ["id", "quantity"]
    def validate(self, attrs):
        if self.instance and attrs.get("unit", self.instance.unit) != self.instance.unit:
            raise serializers.ValidationError("Units cannot change; create a new stock item.")
        return attrs

class AdjustmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = StockAdjustment
        fields = ["id", "item", "delta", "balance_after", "reason", "recorded_by", "created_at"]
        read_only_fields = fields

class AdjustmentInput(serializers.Serializer):
    delta = serializers.DecimalField(max_digits=12, decimal_places=3)
    reason = serializers.CharField(max_length=500, allow_blank=False)
    def validate_delta(self, value):
        if value == 0:
            raise serializers.ValidationError("Adjustment must be nonzero.")
        return value

class StockViewSet(viewsets.ModelViewSet):
    queryset = StockItem.objects.all()
    serializer_class = StockSerializer
    permission_classes = [IsManager]
    http_method_names = ["get", "post", "put", "patch", "head", "options"]
    @transaction.atomic
    def update(self, request, *args, **kwargs):
        self.queryset = StockItem.objects.select_for_update()
        return super().update(request, *args, **kwargs)
    @action(detail=True, methods=["post"])
    @transaction.atomic
    def adjust(self, request, pk=None):
        s = AdjustmentInput(data=request.data); s.is_valid(raise_exception=True)
        item = get_object_or_404(StockItem.objects.select_for_update(), pk=pk)
        if not item.is_active:
            raise ValidationError("Reactivate the stock item before adjusting it.")
        delta = s.validated_data["delta"]
        if item.unit == "units" and delta != delta.to_integral_value():
            raise ValidationError("Unit counts must be whole numbers.")
        balance = item.quantity + delta
        if balance < 0 or balance > Decimal("999999999.999"):
            raise ValidationError("Resulting quantity is outside the supported range.")
        item.quantity = balance; item.save(update_fields=["quantity"])
        adjustment = StockAdjustment.objects.create(item=item, delta=delta, balance_after=balance, reason=s.validated_data["reason"], recorded_by=request.user)
        return Response(AdjustmentSerializer(adjustment).data, status=201)

class AdjustmentViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    queryset = StockAdjustment.objects.all()
    serializer_class = AdjustmentSerializer
    permission_classes = [IsManager]
    def get_queryset(self):
        qs = super().get_queryset()
        value = self.request.query_params.get("item")
        if value is not None:
            try: item_id = int(value)
            except ValueError: raise ValidationError({"item": "Use an integer ID."})
            qs = qs.filter(item_id=item_id)
        return qs
