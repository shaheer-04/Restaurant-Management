from decimal import Decimal
from rest_framework import serializers, viewsets, mixins
from rest_framework.decorators import action
from rest_framework.response import Response
from accounts.permissions import IsManager
from .models import DailyRegister
from .permissions import CanAccessExpenses
from .register_services import today, open_register, close_register, void_expense
from .serializers import ExpenseSerializer

class RegisterSerializer(serializers.ModelSerializer):
    expected_cash = serializers.DecimalField(max_digits=20, decimal_places=2, read_only=True, allow_null=True)
    difference = serializers.DecimalField(max_digits=20, decimal_places=2, read_only=True, allow_null=True)
    is_closed = serializers.BooleanField(read_only=True)
    class Meta:
        model = DailyRegister
        fields = ["id", "business_date", "opening_cash", "opened_by", "opened_at", "is_closed", "cash_sales", "cash_expenses", "expected_cash", "counted_cash", "difference", "closing_notes", "closed_by", "closed_at", "closing_snapshot"]
        read_only_fields = fields

class OpenInput(serializers.Serializer):
    business_date = serializers.DateField(default=today)
    opening_cash = serializers.DecimalField(max_digits=20, decimal_places=2, min_value=Decimal("0"))

class CloseInput(serializers.Serializer):
    counted_cash = serializers.DecimalField(max_digits=20, decimal_places=2, min_value=Decimal("0"))
    closing_notes = serializers.CharField(max_length=500, allow_blank=True, default="")

class RegisterViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    queryset = DailyRegister.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [CanAccessExpenses]
    http_method_names = ["get", "post", "head", "options"]
    @action(detail=False, methods=["post"], url_path="open")
    def open(self, request):
        s = OpenInput(data=request.data); s.is_valid(raise_exception=True)
        register, created = open_register(day=s.validated_data["business_date"], opening_cash=s.validated_data["opening_cash"], user=request.user)
        return Response(RegisterSerializer(register).data, status=201 if created else 200)
    @action(detail=True, methods=["post"], url_path="close")
    def close(self, request, pk=None):
        s = CloseInput(data=request.data); s.is_valid(raise_exception=True)
        register = close_register(pk=pk, counted_cash=s.validated_data["counted_cash"], notes=s.validated_data["closing_notes"], user=request.user)
        return Response(RegisterSerializer(register).data)

from rest_framework.views import APIView
class VoidExpenseView(APIView):
    permission_classes = [IsManager]
    def post(self, request, pk):
        class Input(serializers.Serializer):
            reason = serializers.CharField(max_length=500, allow_blank=False)
        s = Input(data=request.data); s.is_valid(raise_exception=True)
        expense = void_expense(pk=pk, reason=s.validated_data["reason"], user=request.user)
        return Response(ExpenseSerializer(expense).data)
