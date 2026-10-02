import test from "node:test";
import assert from "node:assert/strict";
import {
  cents,
  cartTotal,
  canManage,
  canCook,
  canSell,
  flattenErrors,
  label,
  today,
} from "../src/utils.js";
test("Decimal menu prices use integer cents for cart totals", () => {
  assert.equal(cents("699.00"), 69900);
  assert.equal(cents("0.10"), 10);
  assert.equal(
    cartTotal([
      { price: "0.10", quantity: 3 },
      { price: "0.20", quantity: 1 },
    ]),
    0.5,
  );
});
test("Empty cart has zero total", () => assert.equal(cartTotal([]), 0));
test("Manager can access every workflow", () => {
  const u = { roles: ["Manager"] };
  assert.ok(canManage(u) && canSell(u) && canCook(u));
});
test("Cashier cannot see manager or kitchen screens", () => {
  const u = { roles: ["Cashier"] };
  assert.ok(canSell(u));
  assert.ok(!canManage(u));
  assert.ok(!canCook(u));
});
test("Kitchen cannot see financial screens", () => {
  const u = { roles: ["Kitchen"] };
  assert.ok(canCook(u));
  assert.ok(!canSell(u));
  assert.ok(!canManage(u));
});
test("Superuser access is supported", () =>
  assert.ok(canManage({ is_superuser: true, roles: [] })));
test("Nested API validation messages stay readable", () =>
  assert.equal(
    flattenErrors({ amount: ["Must be positive."], detail: "Invalid." }),
    "amount: Must be positive. Invalid.",
  ));
test("Business date is an ISO date in restaurant timezone", () =>
  assert.match(today(), /^\d{4}-\d{2}-\d{2}$/));
test("Backend status labels are readable", () =>
  assert.equal(label("dine_in"), "Dine In"));
