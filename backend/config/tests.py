from decimal import Decimal
from datetime import timedelta
from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.utils import timezone
from rest_framework.test import APIClient
from orders.models import Order, OrderItem, DiningTable, OrderChange
from menu.models import Category, MenuItem
from payments.models import Payment
from finance.models import DailyRegister, Expense
from inventory.models import StockItem, StockAdjustment

class BackendTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.users = {}
        for role in ["Manager", "Cashier", "Kitchen"]:
            u = get_user_model().objects.create_user(username=role.lower(), password="Restaurant-Test-938!")
            u.groups.add(Group.objects.create(name=role)); self.users[role] = u
        self.manager = self.users["Manager"]
        self.cashier = self.users["Cashier"]
        self.client.force_authenticate(self.cashier)
        self.day = timezone.localdate()
        self.register = DailyRegister.objects.create(business_date=self.day, opening_cash=Decimal("5000"), opened_by=self.cashier)
        self.category = Category.objects.create(name="Burgers")
        self.item = MenuItem.objects.create(name="Tower Burger", short_code="BRG002", category=self.category, price="699.00")
        self.table = DiningTable.objects.create(table_number=1)

    def order(self, ready=True):
        o = Order.objects.create(order_type="dine_in", table=self.table, created_by=self.cashier, status="ready" if ready else "pending", sent_to_kitchen_at=timezone.now() if ready else None)
        OrderItem.objects.create(order=o, menu_item=self.item, item_name=self.item.name, unit_price=self.item.price, quantity=2)
        return o

    def pay(self, order, **extra):
        return self.client.post(f"/api/payments/orders/{order.pk}/checkout/", {"method": "cash", "amount_received": "1500.00", **extra}, format="json")

    def close(self, counted="5000.00", notes=""):
        return self.client.post(f"/api/finance/registers/{self.register.pk}/close/", {"counted_cash": counted, "closing_notes": notes}, format="json")

    def expense(self, **extra):
        return self.client.post("/api/finance/expenses/", {"description": "Oil", "category": "ingredients", "amount": "2500.00", "payment_method": "cash", **extra}, format="json")

    def test_checkout_retry_and_table_release(self):
        o = self.order(); r = self.pay(o); self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["payment"]["change_due"], "102.00")
        self.assertEqual(self.pay(o).status_code, 200)
        self.assertEqual(Payment.objects.count(), 1)
        self.assertEqual(self.pay(o, amount_received="1600.00").status_code, 400)
        o.refresh_from_db(); self.assertEqual(o.status, "completed")
        r = self.client.post("/api/orders/", {"order_type": "dine_in", "table_id": self.table.pk, "items": [{"menu_item_id": self.item.pk, "quantity": 1}]}, format="json")
        self.assertEqual(r.status_code, 201, r.data)

    def test_insufficient_payment_has_no_side_effect(self):
        o = self.order(); self.assertEqual(self.pay(o, amount_received="1.00").status_code, 400)
        o.refresh_from_db(); self.assertEqual(o.status, "ready"); self.assertFalse(Payment.objects.exists())

    def test_card_requires_exact_amount(self):
        o = self.order(); self.assertEqual(self.pay(o, method="card").status_code, 400)
        self.assertEqual(self.pay(o, method="card", amount_received="1398.00").status_code, 201)

    def test_invalid_discount_rolls_back(self):
        o = self.order(); self.assertEqual(self.pay(o, discount_type="percentage", discount_value="101").status_code, 400)
        self.assertFalse(Payment.objects.exists())

    def test_pending_checkout_rejected(self):
        self.assertEqual(self.pay(self.order(ready=False)).status_code, 400)

    def test_missing_register_rejected(self):
        self.register.delete(); o = self.order()
        self.assertEqual(self.pay(o).status_code, 400)
        self.assertEqual(self.expense().status_code, 400)

    def test_close_freezes_totals_and_blocks_entries(self):
        o = self.order(); self.pay(o); self.expense()
        r = self.close("3898.00"); self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["difference"], "0.00")
        self.assertEqual(self.expense().status_code, 400)
        # A successful checkout retry is safe even after closing.
        self.assertEqual(self.pay(o).status_code, 200)
        self.assertEqual(self.pay(self.order()).status_code, 400)
        self.assertEqual(self.close("3898.00").status_code, 200)
        self.assertEqual(self.close("1.00", "changed").status_code, 400)
        r = self.client.get("/api/finance/daily-register/")
        self.assertEqual(r.data["cash_movement"]["net_cash_movement"], "-1102.00")

    def test_closing_difference_requires_note(self):
        self.assertEqual(self.close("4900").status_code, 400)
        self.assertEqual(self.close("4900", "Drawer is short").status_code, 200)

    def test_void_preserves_history_and_report(self):
        r = self.expense(); pk = r.data["id"]
        self.assertEqual(self.client.post(f"/api/finance/expenses/{pk}/void/", {"reason": "Duplicate"}, format="json").status_code, 403)
        self.client.force_authenticate(self.manager)
        self.assertEqual(self.client.post(f"/api/finance/expenses/{pk}/void/", {"reason": "Duplicate"}, format="json").status_code, 200)
        self.assertEqual(Expense.objects.count(), 1)
        self.assertEqual(self.client.get("/api/finance/daily-register/").data["expenses"]["total"], "0.00")

    def test_closed_expense_cannot_be_voided(self):
        pk = self.expense().data["id"]; self.close("2500")
        self.client.force_authenticate(self.manager)
        self.assertEqual(self.client.post(f"/api/finance/expenses/{pk}/void/", {"reason": "Correction"}, format="json").status_code, 400)

    def test_inventory_balances_and_access(self):
        self.assertEqual(self.client.get("/api/inventory/items/").status_code, 403)
        self.client.force_authenticate(self.manager)
        r = self.client.post("/api/inventory/items/", {"name": "Chicken", "unit": "kg"}, format="json")
        self.assertEqual(r.status_code, 201, r.data); pk = r.data["id"]
        url = f"/api/inventory/items/{pk}/adjust/"
        self.assertEqual(self.client.post(url, {"delta": "10", "reason": "Delivery"}, format="json").status_code, 201)
        self.assertEqual(self.client.post(url, {"delta": "-11", "reason": "Usage"}, format="json").status_code, 400)
        self.assertEqual(self.client.post(url, {"delta": "-2.5", "reason": "Usage"}, format="json").status_code, 201)
        self.assertEqual(StockItem.objects.get(pk=pk).quantity, Decimal("7.5"))
        self.assertEqual(StockAdjustment.objects.count(), 2)
        self.assertEqual(self.client.patch(f"/api/inventory/items/{pk}/", {"unit": "units"}, format="json").status_code, 400)

    def test_whole_unit_stock(self):
        self.client.force_authenticate(self.manager)
        item = StockItem.objects.create(name="Boxes", unit="units")
        r = self.client.post(f"/api/inventory/items/{item.pk}/adjust/", {"delta": "0.5", "reason": "Count"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_item_cancel_keeps_audit_and_excludes_total(self):
        o = self.order(ready=False)
        other = OrderItem.objects.create(order=o, menu_item=self.item, item_name=self.item.name, unit_price="699", quantity=1)
        url = f"/api/orders/{o.pk}/items/{other.pk}/"
        r = self.client.patch(url, {"cancel": True, "reason": "Customer changed mind"}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["subtotal"], "1398.00")
        self.assertEqual(OrderItem.objects.count(), 2); self.assertEqual(OrderChange.objects.count(), 1)
        first = o.items.first()
        self.assertEqual(self.client.patch(f"/api/orders/{o.pk}/items/{first.pk}/", {"cancel": True, "reason": "Cancel"}, format="json").status_code, 400)

    def test_item_edit_before_cooking_only(self):
        o = self.order(ready=False); item = o.items.first()
        url = f"/api/orders/{o.pk}/items/{item.pk}/"
        self.assertEqual(self.client.patch(url, {"quantity": 3, "notes": "No mayo"}, format="json").status_code, 200)
        o.status = "preparing"; o.save()
        self.assertEqual(self.client.patch(url, {"quantity": 4}, format="json").status_code, 400)

    def test_kitchen_permissions_and_price_privacy(self):
        o = self.order()
        self.client.force_authenticate(self.users["Kitchen"])
        for url in ["/api/finance/daily-register/", "/api/finance/dashboard/", "/api/inventory/items/", "/api/auth/staff/", "/api/payments/daily-summary/"]:
            self.assertEqual(self.client.get(url).status_code, 403, url)
        r = self.client.get(f"/api/orders/kitchen/{o.pk}/")
        self.assertEqual(r.status_code, 200); self.assertNotIn("subtotal", r.data)
        self.assertNotIn("unit_price", r.data["items"][0])

    def test_staff_permissions_and_password_hashing(self):
        self.assertEqual(self.client.get("/api/auth/staff/").status_code, 403)
        self.client.force_authenticate(self.manager)
        r = self.client.post("/api/auth/staff/", {"username": "newstaff", "password": "A-good-secret-874!", "role": "Cashier"}, format="json")
        self.assertEqual(r.status_code, 201, r.data); self.assertNotIn("password", r.data)
        u = get_user_model().objects.get(username="newstaff"); self.assertTrue(u.check_password("A-good-secret-874!")); self.assertFalse(u.is_staff)
        self.assertEqual(self.client.patch(f"/api/auth/staff/{self.manager.pk}/", {"is_active": False}, format="json").status_code, 400)

    def test_browser_login_requires_csrf(self):
        c = APIClient(enforce_csrf_checks=True)
        data = {"username": "cashier", "password": "Restaurant-Test-938!"}
        self.assertEqual(c.post("/api/auth/login/", data, format="json").status_code, 403)
        token = c.get("/api/auth/csrf/").data["csrfToken"]
        r = c.post("/api/auth/login/", data, format="json", HTTP_X_CSRFTOKEN=token)
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(c.get("/api/auth/me/").status_code, 200)
        self.assertEqual(c.post("/api/auth/logout/", {}, format="json").status_code, 403)
        self.assertEqual(c.post("/api/auth/logout/", {}, format="json", HTTP_X_CSRFTOKEN=r.data["csrfToken"]).status_code, 200)
        self.assertEqual(c.get("/api/auth/me/").status_code, 403)

    def test_reports_invalid_and_empty_date(self):
        self.assertEqual(self.client.get("/api/finance/daily-register/?date=hello").status_code, 400)
        yesterday = self.day - timedelta(days=1)
        r = self.client.get(f"/api/finance/daily-register/?date={yesterday}")
        self.assertEqual(r.data["sales"]["paid_orders"], 0)
        self.assertEqual(r.data["expenses"]["total"], "0.00")

    def test_receipt(self):
        o = self.order(); self.pay(o)
        r = self.client.get(f"/api/payments/orders/{o.pk}/receipt/")
        self.assertEqual(r.status_code, 200); self.assertContains(r, "1398.00")

    def test_register_open_retry(self):
        self.register.delete()
        data = {"opening_cash": "5000.00"}
        self.assertEqual(self.client.post("/api/finance/registers/open/", data, format="json").status_code, 201)
        self.assertEqual(self.client.post("/api/finance/registers/open/", data, format="json").status_code, 200)
        self.assertEqual(self.client.post("/api/finance/registers/open/", {"opening_cash": "1"}, format="json").status_code, 400)

    def test_cashier_dashboard_denied(self):
        self.assertEqual(self.client.get("/api/finance/dashboard/").status_code, 403)
        self.client.force_authenticate(self.manager)
        self.assertEqual(self.client.get("/api/finance/dashboard/").status_code, 200)
