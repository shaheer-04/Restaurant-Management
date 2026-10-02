import React, { useState, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  Plus,
  Minus,
  ShoppingBag,
  UtensilsCrossed,
  Bike,
  Package,
  Trash2,
  Pizza,
  Sandwich,
  Fish,
  Drumstick,
  Coffee,
  ArrowRight,
} from "lucide-react";
import { useApp } from "../App";
import { post } from "../api";
import { money, cartTotal, today } from "../utils";
import {
  PageHead,
  Button,
  Badge,
  ErrorBox,
  Loading,
  Empty,
  Refresh,
  useResource,
  Field,
  MoneyRow,
} from "../ui";
import { OrderDetail } from "./Orders";
export function FoodIcon({ name, size = 42 }) {
  const n = name.toLowerCase();
  const Icon = /pizza/.test(n)
    ? Pizza
    : /fish/.test(n)
      ? Fish
      : /chicken|wing|nugget/.test(n)
        ? Drumstick
        : /drink|juice|tea|coffee/.test(n)
          ? Coffee
          : /burger|sandwich/.test(n)
            ? Sandwich
            : UtensilsCrossed;
  return <Icon size={size} strokeWidth={1.5} />;
}
export default function POS() {
  const { draft, setDraft, notify } = useApp();
  const menu = useResource("/api/menu/items/"),
    categories = useResource("/api/menu/categories/"),
    tables = useResource("/api/orders/tables/", 10000),
    registers = useResource("/api/finance/registers/", 15000);
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState("all"),
    [error, setError] = useState(null),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState(null);
  const lock = useRef(false);
  const activeCategories = (categories.data || []).filter((c) => c.is_active);
  const activeIds = new Set(activeCategories.map((c) => c.id));
  const items = (menu.data || []).filter(
    (i) =>
      activeIds.has(i.category) &&
      (category === "all" || String(i.category) === category) &&
      `${i.name} ${i.short_code}`.toLowerCase().includes(search.toLowerCase()),
  );
  const register = (registers.data || []).find(
    (r) => r.business_date === today(),
  );
  function add(item) {
    if (busy || error?.uncertain) return;
    setDraft((d) => {
      const found = d.items.find((i) => i.id === item.id);
      if (found?.quantity >= 999) return d;
      return {
        ...d,
        items: found
          ? d.items.map((i) =>
              i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i,
            )
          : [
              ...d.items,
              {
                id: item.id,
                name: item.name,
                price: item.price,
                quantity: 1,
                notes: "",
              },
            ],
      };
    });
  }
  function update(id, values) {
    setDraft((d) => ({
      ...d,
      items: d.items.map((i) => (i.id === id ? { ...i, ...values } : i)),
    }));
  }
  async function create() {
    if (lock.current || error?.uncertain || !draft.items.length) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const o = await post("/api/orders/", {
        order_type: draft.type,
        table_id: draft.type === "dine_in" ? Number(draft.table) : null,
        notes: draft.notes,
        items: draft.items.map((i) => ({
          menu_item_id: i.id,
          quantity: i.quantity,
          notes: i.notes,
        })),
      });
      setDraft({ type: "dine_in", table: "", notes: "", items: [] });
      setSelected(o.id);
      notify(`Order #${o.id} created. Send it to the kitchen when ready.`);
      tables.reload();
    } catch (e) {
      setError(e);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <PageHead
        eyebrow="AT THE COUNTER"
        title="Let’s take an order."
        description="Choose a table, add the favourites, and send it to the kitchen."
      >
        <Refresh
          onClick={() => {
            menu.reload();
            categories.reload();
            tables.reload();
            registers.reload();
          }}
        />
      </PageHead>
      <ErrorBox
        error={
          menu.error || categories.error || tables.error || registers.error
        }
      />
      {!registers.loading && (!register || register.is_closed) && (
        <div className="notice">
          <strong>
            {register?.is_closed
              ? "Today’s register is closed."
              : "Open today’s register before checkout."}
          </strong>
          <Link to="/finance">
            Go to cash register <ArrowRight size={15} />
          </Link>
        </div>
      )}
      <div className="pos-layout">
        <section className="catalog">
          <div className="search">
            <Search size={19} />
            <input
              aria-label="Search menu"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search burgers, pizza, drinks…"
            />
            <span className="search-hint">MENU</span>
          </div>
          <div className="category-tabs">
            <button
              className={category === "all" ? "active" : ""}
              onClick={() => setCategory("all")}
            >
              All items{" "}
              <span>
                {
                  (menu.data || []).filter((i) => activeIds.has(i.category))
                    .length
                }
              </span>
            </button>
            {activeCategories.map((c) => (
              <button
                key={c.id}
                className={category === String(c.id) ? "active" : ""}
                onClick={() => setCategory(String(c.id))}
              >
                {c.name}
              </button>
            ))}
          </div>
          {menu.loading || categories.loading ? (
            <Loading />
          ) : items.length ? (
            <div className="food-grid">
              {items.map((i, index) => (
                <button
                  className={`food-card ${!i.is_available ? "unavailable" : ""}`}
                  key={i.id}
                  onClick={() => add(i)}
                  disabled={!i.is_available || busy || error?.uncertain}
                >
                  <div className={`food-art tone-${index % 4}`}>
                    <FoodIcon name={`${i.name} ${i.category_name}`} />
                    <span className="food-code">{i.short_code}</span>
                    {!i.is_available && (
                      <span className="stock-label">Out of stock</span>
                    )}
                  </div>
                  <div className="food-info">
                    <small>{i.category_name}</small>
                    <h3>{i.name}</h3>
                    <div>
                      <strong>{money(i.price)}</strong>
                      <span className="add-circle">
                        <Plus size={17} />
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <Empty
              title="No menu items found"
              text="Try another search or add items in Menu & tables."
            />
          )}
        </section>
        <aside className="cart panel">
          <div className="panel-head">
            <div>
              <h2>Current order</h2>
              <p>
                {draft.items.reduce((a, i) => a + i.quantity, 0)} items selected
              </p>
            </div>
            <ShoppingBag size={22} />
          </div>
          <div className="cart-inner">
            <div className="order-types">
              {[
                { key: "dine_in", name: "Dine-in", Icon: UtensilsCrossed },
                { key: "takeaway", name: "Takeaway", Icon: Package },
                { key: "delivery", name: "Delivery", Icon: Bike },
              ].map(({ key, name, Icon }) => (
                <button
                  key={key}
                  disabled={busy || error?.uncertain}
                  className={draft.type === key ? "active" : ""}
                  onClick={() => setDraft({ ...draft, type: key, table: "" })}
                >
                  <Icon size={17} />
                  {name}
                </button>
              ))}
            </div>
            {draft.type === "dine_in" && (
              <Field label="Table">
                <select
                  value={draft.table}
                  disabled={busy || error?.uncertain}
                  onChange={(e) =>
                    setDraft({ ...draft, table: e.target.value })
                  }
                >
                  <option value="">Choose a free table</option>
                  {(tables.data || [])
                    .filter((t) => t.is_active)
                    .map((t) => (
                      <option
                        key={t.id}
                        value={t.id}
                        disabled={!!t.open_order_id}
                      >
                        Table {t.table_number} · {t.capacity} seats
                        {t.open_order_id ? " · Occupied" : ""}
                      </option>
                    ))}
                </select>
              </Field>
            )}
            <ErrorBox error={error} />
            {error?.uncertain && (
              <div className="notice">
                <Link to="/orders">Check recent orders first</Link>
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (
                      window.confirm(
                        "Have you verified that this order was NOT created?",
                      )
                    )
                      setError(null);
                  }}
                >
                  I checked; allow retry
                </Button>
              </div>
            )}
            <div className="cart-lines">
              {draft.items.length ? (
                draft.items.map((i) => (
                  <div className="cart-item" key={i.id}>
                    <div className="cart-item-top">
                      <strong>{i.name}</strong>
                      <button
                        className="icon-btn"
                        disabled={busy || error?.uncertain}
                        aria-label={`Remove ${i.name}`}
                        onClick={() =>
                          setDraft({
                            ...draft,
                            items: draft.items.filter((v) => v.id !== i.id),
                          })
                        }
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <div className="cart-item-middle">
                      <div className="stepper">
                        <button
                          disabled={i.quantity <= 1 || busy || error?.uncertain}
                          aria-label={`Decrease ${i.name}`}
                          onClick={() =>
                            update(i.id, { quantity: i.quantity - 1 })
                          }
                        >
                          <Minus size={14} />
                        </button>
                        <span>{i.quantity}</span>
                        <button
                          disabled={
                            i.quantity >= 999 || busy || error?.uncertain
                          }
                          aria-label={`Increase ${i.name}`}
                          onClick={() =>
                            update(i.id, { quantity: i.quantity + 1 })
                          }
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <strong>{money(Number(i.price) * i.quantity)}</strong>
                    </div>
                    <input
                      className="inline-note"
                      aria-label={`Notes for ${i.name}`}
                      placeholder="Add an item note…"
                      maxLength={500}
                      disabled={busy || error?.uncertain}
                      value={i.notes}
                      onChange={(e) => update(i.id, { notes: e.target.value })}
                    />
                  </div>
                ))
              ) : (
                <Empty
                  title="Start something tasty"
                  text="Tap a menu item to add it to this order."
                />
              )}
            </div>
            <Field label="Order notes">
              <textarea
                rows={2}
                maxLength={500}
                disabled={busy || error?.uncertain}
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                placeholder="Special instructions for the kitchen"
              />
            </Field>
            <MoneyRow
              label="Estimated subtotal"
              value={cartTotal(draft.items)}
              total
            />
            <p className="small muted">
              Final prices are confirmed by the server. Tax and discounts are
              applied at checkout.
            </p>
            <Button
              className="full"
              onClick={create}
              busy={busy}
              disabled={
                !draft.items.length ||
                (draft.type === "dine_in" && !draft.table) ||
                error?.uncertain
              }
            >
              Create order <ArrowRight size={17} />
            </Button>
          </div>
        </aside>
      </div>
      {selected && (
        <OrderDetail
          id={selected}
          onClose={() => setSelected(null)}
          onChanged={() => {
            tables.reload();
            registers.reload();
          }}
        />
      )}
    </>
  );
}
