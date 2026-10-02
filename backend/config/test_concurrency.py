"""PostgreSQL-only integration tests. SQLite cannot verify row locks."""
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from decimal import Decimal
from unittest import skipUnless
from django.db import connection, close_old_connections
from django.test import TransactionTestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient
from django.contrib.auth.models import Group
from orders.models import Order, OrderItem, DiningTable
from menu.models import MenuItem, Category
from finance.models import DailyRegister, Expense
from payments.models import Payment
from inventory.models import StockItem

@skipUnless(connection.vendor == "postgresql", "Requires PostgreSQL row locks")
class ConcurrencyTests(TransactionTestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username="concurrency", password="test")
        self.user.groups.add(Group.objects.create(name="Manager"))
        self.register = DailyRegister.objects.create(business_date=timezone.localdate(), opening_cash=5000, opened_by=self.user)
        category = Category.objects.create(name="Food")
        self.item = MenuItem.objects.create(name="Burger", short_code="B1", category=category, price=100)
        self.table = DiningTable.objects.create(table_number=1)
        self.order = Order.objects.create(order_type="takeaway", status="ready", sent_to_kitchen_at=timezone.now(), created_by=self.user)
        OrderItem.objects.create(order=self.order, menu_item=self.item, item_name="Burger", unit_price=100, quantity=1)

    def parallel(self, requests):
        barrier = Barrier(len(requests))
        user_id = self.user.pk
        def run(spec):
            close_old_connections()
            try:
                client = APIClient()
                client.force_authenticate(get_user_model().objects.get(pk=user_id))
                barrier.wait(timeout=10)
                response = client.post(spec[0], spec[1], format="json")
                return response.status_code
            finally:
                close_old_connections()
        with ThreadPoolExecutor(max_workers=len(requests)) as pool:
            return list(pool.map(run, requests))

    def test_duplicate_checkout(self):
        spec = (f"/api/payments/orders/{self.order.pk}/checkout/", {"method": "cash", "amount_received": "100.00"})
        self.assertEqual(sorted(self.parallel([spec, spec])), [200, 201])
        self.assertEqual(Payment.objects.count(), 1)

    def test_expense_racing_close(self):
        codes = self.parallel([
            ("/api/finance/expenses/", {"description": "Oil", "category": "ingredients", "amount": "100", "payment_method": "cash"}),
            (f"/api/finance/registers/{self.register.pk}/close/", {"counted_cash": "5000", "closing_notes": "Concurrency test"}),
        ])
        self.assertIn(codes[0], [201, 400]); self.assertEqual(codes[1], 200)
        self.register.refresh_from_db()
        self.assertEqual(self.register.cash_expenses, Decimal("100") if Expense.objects.exists() else Decimal("0"))

    def test_checkout_racing_close(self):
        codes = self.parallel([
            (f"/api/payments/orders/{self.order.pk}/checkout/", {"method": "cash", "amount_received": "100"}),
            (f"/api/finance/registers/{self.register.pk}/close/", {"counted_cash": "5000", "closing_notes": "Concurrency test"}),
        ])
        self.assertIn(codes[0], [201, 400]); self.assertEqual(codes[1], 200)
        self.register.refresh_from_db()
        self.assertEqual(self.register.cash_sales, Decimal("100") if Payment.objects.exists() else Decimal("0"))

    def test_stock_cannot_go_negative(self):
        item = StockItem.objects.create(name="Oil", unit="liters", quantity=10)
        spec = (f"/api/inventory/items/{item.pk}/adjust/", {"delta": "-7", "reason": "Usage"})
        self.assertEqual(sorted(self.parallel([spec, spec])), [201, 400])
        item.refresh_from_db(); self.assertEqual(item.quantity, Decimal("3"))

    def test_table_double_booking(self):
        spec = ("/api/orders/", {"order_type": "dine_in", "table_id": self.table.pk, "items": [{"menu_item_id": self.item.pk, "quantity": 1}]})
        self.assertEqual(sorted(self.parallel([spec, spec])), [201, 400])
