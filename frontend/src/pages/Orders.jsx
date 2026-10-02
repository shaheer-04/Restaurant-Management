import React, { useState, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  Printer,
  Send,
  Check,
  Edit3,
  History,
  Search,
  ArrowRight,
} from "lucide-react";
import { useApp } from "../App";
import { post, patch, receiptURL } from "../api";
import { money, dateTime, label } from "../utils";
import {
  PageHead,
  Button,
  Badge,
  ErrorBox,
  Loading,
  Empty,
  Refresh,
  useResource,
  DataTable,
  Modal,
  Field,
  Select,
  FormModal,
  MoneyRow,
} from "../ui";
export function Checkout({ order, onClose, onPaid }) {
  const [method, setMethod] = useState("cash"),
    [discount, setDiscount] = useState("none"),
    [value, setValue] = useState("0.00"),
    [received, setReceived] = useState(""),
    [quote, setQuote] = useState(null),
    [error, setError] = useState(null),
    [busy, setBusy] = useState(false),
    [retry, setRetry] = useState(false);
  const lock = useRef(false),
    submitted = useRef(null);
  const data = () => ({
    discount_type: discount,
    discount_value: discount === "none" ? "0.00" : value,
  });
  async function preview(e) {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const q = await post(`/api/payments/orders/${order.id}/quote/`, data());
      setQuote(q);
      setReceived(q.total);
    } catch (e) {
      setError(e);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function pay(e) {
    e.preventDefault();
    if (lock.current || !quote) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    const body = submitted.current || {
      ...data(),
      method,
      amount_received: received,
    };
    submitted.current = body;
    try {
      const r = await post(`/api/payments/orders/${order.id}/checkout/`, body);
      onPaid(r.payment);
    } catch (e) {
      setError(e);
      setRetry(e.uncertain);
      if (!e.uncertain) submitted.current = null;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Modal
      title={`Checkout · Order #${order.id}`}
      onClose={onClose}
      locked={busy}
    >
      <div className="modal-body">
        <ErrorBox error={error} />
        <p className="muted">
          Record payment received. Card and wallet payments must already be
          confirmed on your terminal or wallet.
        </p>
        <form onSubmit={preview}>
          <div className="form-grid">
            <Select
              label="Discount"
              value={discount}
              disabled={busy || retry}
              onChange={(e) => {
                setDiscount(e.target.value);
                setQuote(null);
              }}
              options={["none", "flat", "percentage"].map((v) => ({
                value: v,
                label: label(v),
              }))}
            />
            <Field
              label={
                discount === "percentage" ? "Discount (%)" : "Discount amount"
              }
              type="number"
              step="0.01"
              min="0"
              max={discount === "percentage" ? 100 : undefined}
              value={value}
              disabled={discount === "none" || busy || retry}
              onChange={(e) => {
                setValue(e.target.value);
                setQuote(null);
              }}
              required
            />
          </div>
          <Button
            type="submit"
            variant="secondary"
            busy={busy}
            disabled={retry}
          >
            Calculate final bill
          </Button>
        </form>
        {quote && (
          <form onSubmit={pay}>
            <div className="bill">
              <MoneyRow label="Subtotal" value={quote.subtotal} />
              <MoneyRow
                label="Discount"
                value={-Number(quote.discount_amount)}
              />
              <MoneyRow
                label={`Tax (${quote.tax_rate}%)`}
                value={quote.tax_amount}
              />
              <MoneyRow label="Total due" value={quote.total} total />
            </div>
            <div className="form-grid">
              <Select
                label="Payment method"
                value={method}
                disabled={busy || retry}
                onChange={(e) => {
                  setMethod(e.target.value);
                  if (e.target.value !== "cash") setReceived(quote.total);
                }}
                options={[
                  { value: "cash", label: "Cash" },
                  { value: "card", label: "Card" },
                  { value: "wallet", label: "Digital wallet" },
                ]}
              />
              <Field
                label="Amount received"
                type="number"
                min={quote.total}
                step="0.01"
                required
                disabled={busy || retry}
                value={received}
                onChange={(e) => setReceived(e.target.value)}
              />
            </div>
            {method === "cash" && (
              <MoneyRow
                label="Change to return"
                value={Math.max(0, Number(received) - Number(quote.total))}
              />
            )}
            <Button
              type="submit"
              className="full"
              busy={busy}
              disabled={
                Number(received) < Number(quote.total) ||
                (method !== "cash" && Number(received) !== Number(quote.total))
              }
            >
              <Check size={18} />
              {retry
                ? "Retry same payment safely"
                : "Record payment & complete"}
            </Button>
          </form>
        )}
      </div>
    </Modal>
  );
}
export function OrderDetail({ id, onClose, onChanged }) {
  const { notify } = useApp();
  const {
    data: order,
    error,
    loading,
    reload,
  } = useResource(`/api/orders/${id}/`);
  const [busy, setBusy] = useState(false),
    [actionError, setActionError] = useState(null),
    [edit, setEdit] = useState(null),
    [checkout, setCheckout] = useState(false),
    [history, setHistory] = useState(false),
    [add, setAdd] = useState(false);
  const lock = useRef(false);
  const historyData = useResource(`/api/orders/${id}/history/`);
  async function action(path) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setActionError(null);
    try {
      await post(path);
      notify("Order updated");
      await reload();
      onChanged?.();
    } catch (e) {
      setActionError(e);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function changed() {
    reload();
    historyData.reload();
    onChanged?.();
  }
  return (
    <Modal title={`Order #${id}`} onClose={onClose} wide locked={busy}>
      <div className="modal-body">
        <ErrorBox error={error || actionError} />
        {loading ? (
          <Loading />
        ) : (
          order && (
            <>
              <div className="order-meta">
                <Badge value={order.status} />
                <span>
                  {label(order.order_type)}
                  {order.table ? ` · Table ID ${order.table}` : ""}
                </span>
                <span>{dateTime(order.created_at)}</span>
                <Refresh
                  onClick={() => {
                    setActionError(null);
                    changed();
                  }}
                />
              </div>
              {order.notes && <div className="note">{order.notes}</div>}
              <DataTable headers={["Item", "Quantity", "Amount", "Actions"]}>
                {order.items.map((i) => (
                  <tr
                    key={i.id}
                    className={i.is_cancelled ? "cancelled-row" : ""}
                  >
                    <td>
                      <strong>{i.item_name}</strong>
                      <small>{i.notes || "No special notes"}</small>
                      {i.is_cancelled && <Badge value="cancelled" />}
                    </td>
                    <td>{i.quantity}</td>
                    <td>{money(Number(i.unit_price) * i.quantity)}</td>
                    <td>
                      {order.status === "pending" && !i.is_cancelled && (
                        <div className="row-actions">
                          <Button
                            disabled={busy}
                            variant="ghost"
                            onClick={() => setEdit({ item: i, type: "edit" })}
                          >
                            Edit
                          </Button>
                          <Button
                            disabled={busy}
                            variant="danger-ghost"
                            onClick={() => setEdit({ item: i, type: "cancel" })}
                          >
                            Cancel item
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </DataTable>
              <MoneyRow
                label="Subtotal · before discount and tax"
                value={order.subtotal}
                total
              />
              <div className="toolbar wrap">
                {order.status === "pending" && (
                  <>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => setAdd(true)}
                    >
                      <Plus size={16} />
                      Add items
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => setEdit({ type: "notes" })}
                    >
                      <Edit3 size={16} />
                      Order notes
                    </Button>
                    {!order.sent_to_kitchen_at && (
                      <Button
                        busy={busy}
                        onClick={() =>
                          action(`/api/orders/${id}/send-to-kitchen/`)
                        }
                      >
                        <Send size={16} />
                        Send to kitchen
                      </Button>
                    )}
                    <Button
                      variant="danger-ghost"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(`Cancel all of order #${id}?`))
                          action(`/api/orders/${id}/cancel/`);
                      }}
                    >
                      Cancel order
                    </Button>
                  </>
                )}
                {order.status === "ready" && (
                  <Button onClick={() => setCheckout(true)}>
                    Checkout <ArrowRight size={16} />
                  </Button>
                )}
                {order.status === "completed" && (
                  <a
                    className="btn"
                    href={receiptURL(id)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Printer size={16} />
                    Open receipt
                  </a>
                )}
                <Button variant="ghost" onClick={() => setHistory(!history)}>
                  <History size={16} />
                  History
                </Button>
              </div>
              {order.status === "pending" && order.sent_to_kitchen_at && (
                <p className="success-text">
                  Sent to kitchen · waiting for preparation
                </p>
              )}
              {history && (
                <div className="history">
                  <h3>Order changes</h3>
                  <ErrorBox error={historyData.error} />
                  {historyData.data?.length ? (
                    historyData.data.map((h) => (
                      <div key={h.id}>
                        <strong>{label(h.action)}</strong>
                        <span>
                          {dateTime(h.created_at)} · Staff #{h.actor_id}
                        </span>
                        <pre>{JSON.stringify(h.detail, null, 2)}</pre>
                      </div>
                    ))
                  ) : (
                    <p className="muted">No changes recorded.</p>
                  )}
                </div>
              )}
            </>
          )
        )}
      </div>
      {checkout && (
        <Checkout
          order={order}
          onClose={() => setCheckout(false)}
          onPaid={() => {
            setCheckout(false);
            notify("Payment recorded. Order completed.");
            changed();
          }}
        />
      )}
      {edit && (
        <FormModal
          title={
            edit.type === "notes"
              ? "Order notes"
              : edit.type === "cancel"
                ? "Cancel item"
                : "Edit item"
          }
          onClose={() => setEdit(null)}
          initial={
            edit.type === "notes"
              ? { notes: order.notes }
              : edit.type === "edit"
                ? { quantity: edit.item.quantity, notes: edit.item.notes }
                : { reason: "" }
          }
          fields={
            edit.type === "notes"
              ? [
                  {
                    name: "notes",
                    label: "Notes",
                    type: "textarea",
                    required: false,
                  },
                ]
              : edit.type === "cancel"
                ? [
                    {
                      name: "reason",
                      label: "Cancellation reason",
                      type: "textarea",
                      required: true,
                    },
                  ]
                : [
                    {
                      name: "quantity",
                      label: "Quantity",
                      type: "number",
                      min: 1,
                      max: 999,
                      step: 1,
                    },
                    {
                      name: "notes",
                      label: "Item notes",
                      type: "textarea",
                      required: false,
                    },
                  ]
          }
          onSave={async (v) => {
            await patch(
              edit.type === "notes"
                ? `/api/orders/${id}/notes/`
                : `/api/orders/${id}/items/${edit.item.id}/`,
              edit.type === "cancel"
                ? { cancel: true, reason: v.reason }
                : edit.type === "edit"
                  ? { quantity: Number(v.quantity), notes: v.notes }
                  : v,
            );
            changed();
            notify("Order updated");
          }}
        />
      )}
      {add && (
        <AddItems
          orderId={id}
          onClose={() => setAdd(false)}
          onSaved={() => {
            changed();
            notify("Items added");
          }}
        />
      )}
    </Modal>
  );
}
function AddItems({ orderId, onClose, onSaved }) {
  const { data, error, loading } = useResource("/api/menu/items/");
  const { data: categories } = useResource("/api/menu/categories/");
  const [selected, setSelected] = useState(""),
    [quantity, setQuantity] = useState(1),
    [notes, setNotes] = useState(""),
    [busy, setBusy] = useState(false),
    [err, setErr] = useState(null);
  const lock = useRef(false);
  async function save(e) {
    e.preventDefault();
    if (lock.current || err?.uncertain) return;
    lock.current = true;
    setBusy(true);
    try {
      await post(`/api/orders/${orderId}/add-items/`, {
        items: [
          { menu_item_id: Number(selected), quantity: Number(quantity), notes },
        ],
      });
      onSaved();
      onClose();
    } catch (e) {
      setErr(e);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Modal title="Add an item" onClose={onClose} locked={busy}>
      <form onSubmit={save}>
        <div className="modal-body">
          <ErrorBox error={error || err} />
          {loading ? (
            <Loading />
          ) : (
            <>
              <Select
                label="Menu item"
                required
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                options={[
                  { value: "", label: "Choose an available item" },
                  ...(data || [])
                    .filter(
                      (i) =>
                        i.is_available &&
                        (categories || []).some(
                          (c) => c.id === i.category && c.is_active,
                        ),
                    )
                    .map((i) => ({
                      value: i.id,
                      label: `${i.name} · ${money(i.price)}`,
                    })),
                ]}
              />
              <Field
                label="Quantity"
                type="number"
                min="1"
                max="999"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
              <Field label="Notes">
                <textarea
                  maxLength={500}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </Field>
            </>
          )}
        </div>
        <div className="modal-foot">
          <Button
            type="submit"
            busy={busy}
            disabled={!selected || err?.uncertain}
          >
            Add item
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export default function Orders() {
  const [status, setStatus] = useState(""),
    [selected, setSelected] = useState(null),
    [query, setQuery] = useState("");
  const { data, error, loading, reload } = useResource(
    `/api/orders/${status ? `?status=${status}` : ""}`,
    10000,
  );
  const rows = (data || []).filter((o) => String(o.id).includes(query));
  return (
    <>
      <PageHead
        title="Orders"
        description="Follow every order from the counter to completion."
      >
        <Refresh onClick={reload} />
        <Link className="btn" to="/pos">
          <Plus size={17} />
          New order
        </Link>
      </PageHead>
      <div className="toolbar">
        <div className="search">
          <Search size={18} />
          <input
            aria-label="Search order number"
            placeholder="Search order number…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          aria-label="Order status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          {["pending", "preparing", "ready", "completed", "cancelled"].map(
            (s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ),
          )}
        </select>
      </div>
      <ErrorBox error={error} />
      <section className="panel">
        {loading ? (
          <Loading />
        ) : rows.length ? (
          <DataTable
            headers={[
              "Order",
              "Type / table",
              "Status",
              "Subtotal",
              "Created",
              "",
            ]}
          >
            {rows.map((o) => (
              <tr key={o.id}>
                <td>
                  <strong>#{o.id}</strong>
                  <small>
                    {o.items
                      .filter((i) => !i.is_cancelled)
                      .reduce((a, i) => a + i.quantity, 0)}{" "}
                    items
                  </small>
                </td>
                <td>
                  {label(o.order_type)}
                  {o.table && <small>Table ID {o.table}</small>}
                </td>
                <td>
                  <Badge value={o.status} />
                </td>
                <td>{money(o.subtotal)}</td>
                <td>{dateTime(o.created_at)}</td>
                <td>
                  <Button variant="secondary" onClick={() => setSelected(o.id)}>
                    View order
                  </Button>
                </td>
              </tr>
            ))}
          </DataTable>
        ) : (
          <Empty
            title="No orders found"
            text="Create an order or choose another status."
          />
        )}
      </section>
      {selected && (
        <OrderDetail
          id={selected}
          onClose={() => setSelected(null)}
          onChanged={reload}
        />
      )}
    </>
  );
}
