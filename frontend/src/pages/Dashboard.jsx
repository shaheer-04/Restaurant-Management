import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Receipt,
  Wallet,
  ShoppingBag,
  Package,
  ArrowRight,
} from "lucide-react";
import {
  PageHead,
  Stat,
  ErrorBox,
  Loading,
  Empty,
  Refresh,
  useResource,
  DataTable,
  Field,
} from "../ui";
import { money, today, label } from "../utils";
export default function Dashboard() {
  const [date, setDate] = useState(today());
  const { data, error, loading, reload } = useResource(
    `/api/finance/dashboard/?date=${date}`,
  );
  const sales = data?.daily_report.sales,
    expenses = data?.daily_report.expenses;
  return (
    <>
      <PageHead
        eyebrow="THE BIG PICTURE"
        title="A good day starts here."
        description="Keep an eye on service, sales and the essentials."
      >
        <Field
          label="Report date"
          type="date"
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
        />
        <Refresh onClick={reload} />
      </PageHead>
      <ErrorBox error={error} />
      {loading ? (
        <Loading />
      ) : (
        data && (
          <>
            <section className="hero-banner">
              <div>
                <span className="eyebrow">READY FOR SERVICE</span>
                <h2>Good food. Better flow.</h2>
                <p>Everything your team needs to keep orders moving.</p>
                <Link className="btn yellow" to="/pos">
                  Open point of sale <ArrowRight size={17} />
                </Link>
              </div>
              <div className="hero-word" aria-hidden="true">
                COD<span>ORDER. COOK. SERVE.</span>
              </div>
            </section>
            <div className="stats">
              <Stat
                label="Total collected"
                value={money(sales.total_collected)}
                icon={Wallet}
                small="Including tax"
                accent
              />
              <Stat
                label="Paid orders"
                value={sales.paid_orders}
                icon={ShoppingBag}
                small="Payments recorded on this date"
              />
              <Stat
                label="Recorded expenses"
                value={money(expenses.total)}
                icon={Receipt}
                small={`${expenses.count} expense entries`}
              />
              <Stat
                label="Low-stock items"
                value={data.low_stock.length}
                icon={Package}
                small="Current active inventory"
              />
            </div>
            <div className="dashboard-grid">
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h2>Payments at a glance</h2>
                    <p>Collections by payment method</p>
                  </div>
                  <span className="pill">{date}</span>
                </div>
                <div className="payment-bars">
                  {Object.entries(sales.payment_methods).map(([key, v]) => (
                    <div className="payment-bar" key={key}>
                      <div>
                        <strong>{v.label}</strong>
                        <span>{money(v.total_collected)}</span>
                      </div>
                      <div className="bar-track">
                        <div
                          className={key}
                          style={{
                            width: `${Number(sales.total_collected) ? (Number(v.total_collected) / Number(sales.total_collected)) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <small>{v.paid_orders} paid orders</small>
                    </div>
                  ))}
                </div>
                <div className="panel-footer">
                  <span>Net sales before tax</span>
                  <strong>{money(sales.net_sales_before_tax)}</strong>
                </div>
              </section>
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h2>On the floor</h2>
                    <p>Current order status, across all dates</p>
                  </div>
                  <Link className="text-link" to="/orders">
                    View orders <ArrowUpRight size={16} />
                  </Link>
                </div>
                <div className="status-grid">
                  {["pending", "preparing", "ready", "completed"].map((s) => (
                    <div key={s}>
                      <span className={`status-dot ${s}`} />
                      <span>{label(s)}</span>
                      <strong>
                        {data.current_order_counts.find((c) => c.status === s)
                          ?.count || 0}
                      </strong>
                    </div>
                  ))}
                </div>
                <div className="callout">
                  <strong>Keep the kitchen in sync</strong>
                  <p>Kitchen tickets refresh every 5 seconds.</p>
                  <Link to="/kitchen" className="text-link">
                    Open kitchen display <ArrowRight size={15} />
                  </Link>
                </div>
              </section>
            </div>
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>Time to restock</h2>
                  <p>Items at or below their stock threshold</p>
                </div>
                <Link to="/inventory" className="text-link">
                  Manage inventory <ArrowUpRight size={16} />
                </Link>
              </div>
              {data.low_stock.length ? (
                <DataTable
                  headers={["Ingredient / item", "Available", "Threshold"]}
                >
                  {data.low_stock.map((i) => (
                    <tr key={i.id}>
                      <td>
                        <strong>{i.name}</strong>
                      </td>
                      <td>
                        <span className="badge pending">
                          {i.quantity} {i.unit}
                        </span>
                      </td>
                      <td>
                        {i.low_stock_threshold} {i.unit}
                      </td>
                    </tr>
                  ))}
                </DataTable>
              ) : (
                <Empty
                  title="Stock is looking good"
                  text="No active items are below their threshold."
                />
              )}
            </section>
            <div className="financial-note">
              <strong>
                Sales less recorded expenses, before tax:{" "}
                {money(data.sales_less_recorded_expenses_before_tax)}
              </strong>
              <p>{data.report_basis}</p>
            </div>
          </>
        )
      )}
    </>
  );
}
