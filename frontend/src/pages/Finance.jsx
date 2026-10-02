import React, { useState } from "react";
import {
  Plus,
  Wallet,
  Receipt,
  LockKeyhole,
  Unlock,
  ArrowLeft,
  ArrowRight,
  History,
} from "lucide-react";
import { useApp } from "../App";
import { post } from "../api";
import { money, today, dateTime, label, canManage } from "../utils";
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
  FormModal,
  Field,
  Stat,
  MoneyRow,
  Modal,
} from "../ui";
const categoryOptions = [
  "ingredients",
  "packaging",
  "utilities",
  "rent",
  "salaries",
  "maintenance",
  "other",
].map((v) => ({ value: v, label: label(v) }));
export default function Finance() {
  const { user, notify } = useApp();
  const manager = canManage(user);
  const [date, setDate] = useState(today()),
    [page, setPage] = useState(1),
    [modal, setModal] = useState(null),
    [view, setView] = useState(null);
  const report = useResource(`/api/finance/daily-register/?date=${date}`),
    registers = useResource("/api/finance/registers/"),
    expenses = useResource(`/api/finance/expenses/?date=${date}&page=${page}`);
  const r = (registers.data || []).find((v) => v.business_date === date);
  const cash = report.data?.cash_movement;
  const expected = r
    ? Number(r.opening_cash) + Number(cash?.net_cash_movement || 0)
    : null;
  function reload() {
    report.reload();
    registers.reload();
    expenses.reload();
  }
  const canRecord = r && !r.is_closed;
  const changeDate = (v) => {
    if (v) {
      setDate(v);
      setPage(1);
    }
  };
  return (
    <>
      <PageHead
        eyebrow="DAILY OPERATIONS"
        title="Cash & expenses"
        description="A clear view of what came in, what went out, and what’s in the drawer."
      >
        <Field
          label="Business date"
          type="date"
          max={today()}
          value={date}
          onChange={(e) => changeDate(e.target.value)}
        />
        <Refresh onClick={reload} />
      </PageHead>
      <ErrorBox error={report.error || registers.error || expenses.error} />
      {report.loading || registers.loading ? (
        <Loading />
      ) : (
        <>
          <section
            className={`register-banner ${r?.is_closed ? "closed" : ""}`}
          >
            <div className="register-icon">
              {r?.is_closed ? <LockKeyhole size={27} /> : <Wallet size={27} />}
            </div>
            <div>
              <div className="eyebrow">CASH REGISTER · {date}</div>
              <h2>
                {r
                  ? r.is_closed
                    ? "Day closed & recorded"
                    : "Ready for transactions"
                  : "Start with your opening cash"}
              </h2>
              <p>
                {r
                  ? r.is_closed
                    ? `Closed ${dateTime(r.closed_at)} · Report saved`
                    : `Opening cash ${money(r.opening_cash)} · Register #${r.id}`
                  : "Open the register before recording payments or expenses."}
              </p>
            </div>
            <div className="register-actions">
              {!r && (manager || date === today()) && (
                <Button
                  variant="yellow"
                  onClick={() => setModal({ type: "open" })}
                >
                  <Unlock size={17} />
                  Open register
                </Button>
              )}
              {canRecord && (
                <Button
                  variant="yellow"
                  onClick={() => setModal({ type: "close" })}
                >
                  <LockKeyhole size={17} />
                  Close register
                </Button>
              )}
            </div>
          </section>
          {report.data && (
            <>
              <div className="stats">
                <Stat
                  label="Total collected"
                  value={money(report.data.sales.total_collected)}
                  icon={Wallet}
                  small={`${report.data.sales.paid_orders} paid orders`}
                  accent
                />
                <Stat
                  label="Recorded expenses"
                  value={money(report.data.expenses.total)}
                  icon={Receipt}
                  small="All payment methods"
                />
                <Stat
                  label="Cash sales"
                  value={money(cash.cash_collected_from_sales)}
                  small="After customer change"
                />
                <Stat
                  label={
                    r?.is_closed
                      ? "Counted closing cash"
                      : "Expected drawer cash"
                  }
                  value={
                    r?.is_closed
                      ? money(r.counted_cash)
                      : r
                        ? money(expected)
                        : "—"
                  }
                  small={
                    r?.is_closed
                      ? `Difference ${money(r.difference)}`
                      : "Opening + cash sales − cash expenses"
                  }
                />
              </div>
              <div className="finance-grid">
                <section className="panel">
                  <div className="panel-head">
                    <h2>Cash movement</h2>
                    <Badge
                      value={r ? (r.is_closed ? "closed" : "open") : "not_open"}
                    />
                  </div>
                  <div className="panel-body">
                    <MoneyRow label="Opening cash" value={r?.opening_cash} />
                    <MoneyRow
                      label="Cash collected"
                      value={cash.cash_collected_from_sales}
                    />
                    <MoneyRow
                      label="Cash expenses"
                      value={-Number(cash.cash_expenses)}
                    />
                    <MoneyRow
                      label={r ? "Expected cash" : "Net cash movement"}
                      value={r ? expected : cash.net_cash_movement}
                      total
                    />
                    {r?.is_closed && (
                      <>
                        <MoneyRow label="Counted cash" value={r.counted_cash} />
                        <MoneyRow label="Difference" value={r.difference} />
                        {r.closing_notes && (
                          <p className="note">{r.closing_notes}</p>
                        )}
                      </>
                    )}
                    <p className="small muted">
                      Cash expenses are paid from this drawer. Transfers and
                      separate petty cash are not tracked.
                    </p>
                  </div>
                </section>
                <section className="panel">
                  <div className="panel-head">
                    <h2>Payment methods</h2>
                    <span className="pill">PKR</span>
                  </div>
                  <DataTable headers={["Method", "Collected", "Expenses"]}>
                    {["cash", "card", "wallet"].map((method) => (
                      <tr key={method}>
                        <td>
                          <strong>{label(method)}</strong>
                        </td>
                        <td>
                          {money(
                            report.data.sales.payment_methods[method]
                              .total_collected,
                          )}
                        </td>
                        <td>
                          {money(
                            report.data.expenses.payment_methods[method].amount,
                          )}
                        </td>
                      </tr>
                    ))}
                  </DataTable>
                  <div className="panel-footer">
                    <span>Tax collected</span>
                    <strong>{money(report.data.sales.tax_collected)}</strong>
                  </div>
                </section>
              </div>
            </>
          )}
        </>
      )}
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Expenses</h2>
            <p>Recorded for {date} · voided entries remain in the history</p>
          </div>
          <Button
            disabled={!canRecord}
            onClick={() => setModal({ type: "expense" })}
          >
            <Plus size={17} />
            Record expense
          </Button>
        </div>
        {expenses.loading ? (
          <Loading />
        ) : expenses.data?.results?.length ? (
          <>
            <DataTable
              headers={[
                "Description",
                "Category",
                "Amount",
                "Method",
                "Status",
                "",
              ]}
            >
              {expenses.data.results.map((e) => (
                <tr key={e.id} className={e.voided_at ? "cancelled-row" : ""}>
                  <td>
                    <strong>{e.description}</strong>
                    <small>
                      #{e.id} · {e.recorded_by_username}
                    </small>
                    {e.notes && <small>{e.notes}</small>}
                    {e.void_reason && (
                      <small>Void reason: {e.void_reason}</small>
                    )}
                  </td>
                  <td>{label(e.category)}</td>
                  <td>{money(e.amount)}</td>
                  <td>{label(e.payment_method)}</td>
                  <td>
                    <Badge value={e.voided_at ? "voided" : "recorded"} />
                  </td>
                  <td>
                    {manager && !e.voided_at && canRecord && (
                      <Button
                        variant="danger-ghost"
                        onClick={() => setModal({ type: "void", expense: e })}
                      >
                        Void
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </DataTable>
            <div className="pagination">
              <span>
                {expenses.data.count} entries · Page {page}
              </span>
              <div className="row-actions">
                <Button
                  variant="secondary"
                  disabled={!expenses.data.previous}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ArrowLeft size={16} />
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  disabled={!expenses.data.next}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                  <ArrowRight size={16} />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <Empty
            title="No expenses recorded"
            text={
              canRecord
                ? "Record purchases and operating expenses for this date."
                : "Open a register for this date to record expenses."
            }
          />
        )}
      </section>
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Register history</h2>
            <p>Opening balances and saved closing counts</p>
          </div>
          <History size={20} />
        </div>
        {registers.data?.length ? (
          <DataTable
            headers={[
              "Date",
              "Opening cash",
              "Counted cash",
              "Difference",
              "Status",
              "",
            ]}
          >
            {registers.data.map((reg) => (
              <tr key={reg.id}>
                <td>
                  <strong>{reg.business_date}</strong>
                </td>
                <td>{money(reg.opening_cash)}</td>
                <td>
                  {reg.counted_cash === null ? "—" : money(reg.counted_cash)}
                </td>
                <td>{reg.difference === null ? "—" : money(reg.difference)}</td>
                <td>
                  <Badge value={reg.is_closed ? "closed" : "open"} />
                </td>
                <td>
                  <Button
                    variant="ghost"
                    onClick={() => changeDate(reg.business_date)}
                  >
                    View day
                  </Button>
                </td>
              </tr>
            ))}
          </DataTable>
        ) : (
          <Empty
            title="No registers yet"
            text="Open your first day to start recording transactions."
          />
        )}
      </section>
      {modal?.type === "open" && (
        <FormModal
          title={`Open register · ${date}`}
          description="Enter the cash in the drawer at the start of this date. Existing transactions for this date are included separately."
          initial={{ opening_cash: "" }}
          fields={[
            {
              name: "opening_cash",
              label: "Opening cash (PKR)",
              type: "number",
              min: 0,
              step: "0.01",
            },
          ]}
          submit="Open register"
          onClose={() => setModal(null)}
          onSave={async (v) => {
            await post("/api/finance/registers/open/", {
              ...v,
              business_date: date,
            });
            notify("Register opened");
            reload();
          }}
        />
      )}
      {modal?.type === "close" && (
        <FormModal
          title={`Close register · ${date}`}
          description={`Expected cash currently ${money(expected)}. Count the drawer, then close. Closing saves the report and blocks all further payments, expenses and corrections for this date. There is no reopen action.`}
          initial={{ counted_cash: "", closing_notes: "" }}
          fields={[
            {
              name: "counted_cash",
              label: "Counted cash (PKR)",
              type: "number",
              min: 0,
              step: "0.01",
            },
            {
              name: "closing_notes",
              label: "Closing notes",
              type: "textarea",
              required: false,
              hint: "Required if counted cash differs from expected cash.",
            },
          ]}
          submit="Confirm & close day"
          onClose={() => setModal(null)}
          onSave={async (v) => {
            await post(`/api/finance/registers/${r.id}/close/`, v);
            notify("Day closed. Closing report saved.");
            reload();
          }}
        />
      )}
      {modal?.type === "expense" && (
        <FormModal
          title="Record expense"
          description={`Expense date: ${date}. Choose Cash only when paid from the register drawer.`}
          initial={{
            description: "",
            category: "ingredients",
            amount: "",
            payment_method: "cash",
            notes: "",
          }}
          fields={[
            { name: "description", label: "Description" },
            {
              name: "category",
              label: "Category",
              type: "select",
              options: categoryOptions,
            },
            {
              name: "amount",
              label: "Amount (PKR)",
              type: "number",
              min: "0.01",
              step: "0.01",
            },
            {
              name: "payment_method",
              label: "Payment method",
              type: "select",
              options: ["cash", "card", "wallet"].map((v) => ({
                value: v,
                label: label(v),
              })),
            },
            {
              name: "notes",
              label: "Notes",
              type: "textarea",
              required: false,
            },
          ]}
          submit="Record expense"
          onClose={() => setModal(null)}
          onSave={async (v) => {
            await post("/api/finance/expenses/", { ...v, expense_date: date });
            notify("Expense recorded");
            reload();
          }}
        />
      )}
      {modal?.type === "void" && (
        <FormModal
          title="Void expense"
          description={`Void “${modal.expense.description}” (${money(modal.expense.amount)})? The entry remains in the audit history and is excluded from totals. Enter a replacement separately if needed.`}
          initial={{ reason: "" }}
          fields={[
            {
              name: "reason",
              label: "Reason",
              type: "textarea",
              required: true,
            },
          ]}
          submit="Void expense"
          onClose={() => setModal(null)}
          onSave={async (v) => {
            await post(`/api/finance/expenses/${modal.expense.id}/void/`, v);
            notify("Expense voided");
            reload();
          }}
        />
      )}
    </>
  );
}
