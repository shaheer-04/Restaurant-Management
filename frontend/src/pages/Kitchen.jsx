import React, { useState, useRef } from "react";
import { Clock, ChefHat, CheckCircle2, RefreshCw } from "lucide-react";
import { post } from "../api";
import { useApp } from "../App";
import {
  PageHead,
  Button,
  Badge,
  ErrorBox,
  Loading,
  Empty,
  Refresh,
  useResource,
} from "../ui";
import { label } from "../utils";
export default function Kitchen() {
  const { data, error, loading, reload } = useResource(
    "/api/orders/kitchen/",
    5000,
  );
  const [busy, setBusy] = useState({}),
    [actionError, setActionError] = useState(null);
  const locks = useRef(new Set());
  const { notify } = useApp();
  async function advance(o) {
    if (locks.current.has(o.id)) return;
    locks.current.add(o.id);
    setBusy((v) => ({ ...v, [o.id]: true }));
    setActionError(null);
    try {
      await post(
        `/api/orders/kitchen/${o.id}/${o.status === "pending" ? "start-preparing" : "mark-ready"}/`,
      );
      notify(`Order #${o.id} updated`);
      await reload();
    } catch (e) {
      setActionError(e);
      reload();
    } finally {
      locks.current.delete(o.id);
      setBusy((v) => ({ ...v, [o.id]: false }));
    }
  }
  return (
    <>
      <PageHead
        eyebrow="IN THE KITCHEN"
        title="Fresh tickets. Clear focus."
        description="Live orders refresh every 5 seconds while this tab is visible."
      >
        <span className={`live-pill ${error ? "offline" : ""}`}>
          <span />
          {error ? "Connection interrupted" : "Auto-refresh · 5s"}
        </span>
        <Refresh onClick={reload} />
      </PageHead>
      <ErrorBox error={error || actionError} />
      {loading ? (
        <Loading />
      ) : (
        <div className="kitchen-columns">
          {["pending", "preparing", "ready"].map((status) => {
            const orders = (data || []).filter((o) => o.status === status);
            return (
              <section className={`kitchen-column ${status}`} key={status}>
                <div className="column-head">
                  <h2>
                    {status === "pending" ? "New tickets" : label(status)}
                  </h2>
                  <span>{orders.length}</span>
                </div>
                {orders.length ? (
                  orders.map((o) => (
                    <article className="ticket" key={o.id}>
                      <div className="ticket-head">
                        <div>
                          <strong>#{o.id}</strong>
                          <p>
                            {o.order_type === "dine_in"
                              ? `Table ${o.table_number}`
                              : label(o.order_type)}
                          </p>
                        </div>
                        <span className="ticket-time">
                          <Clock size={14} />
                          {Math.max(
                            0,
                            Math.floor(
                              (Date.now() -
                                new Date(o.sent_to_kitchen_at).getTime()) /
                                60000,
                            ),
                          )}{" "}
                          min
                        </span>
                      </div>
                      <div className="ticket-items">
                        {o.items.map((i) => (
                          <div key={i.id}>
                            <span className="ticket-qty">{i.quantity}</span>
                            <div>
                              <strong>{i.item_name}</strong>
                              {i.notes && <p>{i.notes}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                      {o.notes && <div className="ticket-note">{o.notes}</div>}
                      {status !== "ready" ? (
                        <Button
                          className="full"
                          variant={status === "preparing" ? "yellow" : ""}
                          busy={busy[o.id]}
                          onClick={() => advance(o)}
                        >
                          {status === "pending" ? (
                            <ChefHat size={17} />
                          ) : (
                            <CheckCircle2 size={17} />
                          )}{" "}
                          {status === "pending"
                            ? "Start preparing"
                            : "Mark ready"}
                        </Button>
                      ) : (
                        <div className="ready-label">
                          <CheckCircle2 size={17} />
                          Ready for service & checkout
                        </div>
                      )}
                    </article>
                  ))
                ) : (
                  <Empty
                    title={
                      status === "pending" ? "All caught up" : "No tickets"
                    }
                    text={
                      status === "pending"
                        ? "New orders will appear here."
                        : "Orders will move here as service progresses."
                    }
                  />
                )}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
