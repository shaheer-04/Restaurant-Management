import React, { useState } from "react";
import { Plus, Package, AlertTriangle, Search, History } from "lucide-react";
import { useApp } from "../App";
import { post, patch } from "../api";
import { dateTime } from "../utils";
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
  Modal,
  Stat,
} from "../ui";
export default function Inventory() {
  const stock = useResource("/api/inventory/items/");
  const [edit, setEdit] = useState(null),
    [adjust, setAdjust] = useState(null),
    [history, setHistory] = useState(null),
    [query, setQuery] = useState("");
  const { notify } = useApp();
  const rows = (stock.data || []).filter((i) =>
    i.name.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHead
        title="Inventory"
        description="Track ingredients, packaging and the stock behind every order."
      >
        <Refresh onClick={stock.reload} />
        <Button onClick={() => setEdit({})}>
          <Plus size={17} />
          Add stock item
        </Button>
      </PageHead>
      <div className="stats two">
        <Stat
          label="Active stock items"
          value={(stock.data || []).filter((i) => i.is_active).length}
          icon={Package}
        />
        <Stat
          label="Need attention"
          value={
            (stock.data || []).filter(
              (i) =>
                i.is_active &&
                Number(i.quantity) <= Number(i.low_stock_threshold),
            ).length
          }
          icon={AlertTriangle}
          small="At or below threshold"
        />
      </div>
      <div className="toolbar">
        <div className="search">
          <Search size={18} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search stock…"
            aria-label="Search stock"
          />
        </div>
      </div>
      <ErrorBox error={stock.error} />
      <section className="panel">
        {stock.loading ? (
          <Loading />
        ) : rows.length ? (
          <DataTable
            headers={[
              "Stock item",
              "Quantity",
              "Threshold",
              "Status",
              "Actions",
            ]}
          >
            {rows.map((i) => (
              <tr key={i.id}>
                <td>
                  <strong>{i.name}</strong>
                  <small>{i.unit}</small>
                </td>
                <td>
                  <strong>
                    {i.quantity} {i.unit}
                  </strong>
                </td>
                <td>{i.low_stock_threshold}</td>
                <td>
                  <Badge
                    value={
                      !i.is_active
                        ? "inactive"
                        : Number(i.quantity) <= Number(i.low_stock_threshold)
                          ? "low_stock"
                          : "in_stock"
                    }
                  />
                </td>
                <td>
                  <div className="row-actions">
                    <Button
                      variant="secondary"
                      disabled={!i.is_active}
                      onClick={() => setAdjust(i)}
                    >
                      Adjust
                    </Button>
                    <Button variant="ghost" onClick={() => setEdit(i)}>
                      Edit
                    </Button>
                    <button
                      className="icon-btn"
                      aria-label={`History for ${i.name}`}
                      onClick={() => setHistory(i)}
                    >
                      <History size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        ) : (
          <Empty
            title="No stock items yet"
            text="Add an ingredient or packaging item, then record its opening quantity."
          />
        )}
      </section>
      {edit && (
        <FormModal
          title={edit.id ? "Edit stock item" : "Add stock item"}
          onClose={() => setEdit(null)}
          initial={{
            name: "",
            unit: "kg",
            low_stock_threshold: "0",
            ...edit,
            is_active: edit.id ? String(edit.is_active) : "true",
          }}
          fields={[
            { name: "name", label: "Name", maxLength: 150 },
            {
              name: "unit",
              label: "Unit",
              type: "select",
              hidden: !!edit.id,
              options: [
                { value: "kg", label: "Kilograms" },
                { value: "liters", label: "Liters" },
                { value: "units", label: "Units" },
              ],
            },
            {
              name: "low_stock_threshold",
              label: "Low stock threshold",
              type: "number",
              min: 0,
              step: "0.001",
            },
            {
              name: "is_active",
              label: "Status",
              type: "select",
              options: [
                { value: "true", label: "Active" },
                { value: "false", label: "Inactive" },
              ],
            },
          ]}
          description={
            edit.id
              ? "Units stay fixed so the adjustment history remains consistent."
              : "New items start at zero. Use Adjust to record opening stock."
          }
          onSave={async (v) => {
            const body = {
              name: v.name,
              low_stock_threshold: v.low_stock_threshold,
              is_active: v.is_active === "true",
              ...(!edit.id ? { unit: v.unit } : {}),
            };
            if (edit.id) await patch(`/api/inventory/items/${edit.id}/`, body);
            else await post("/api/inventory/items/", body);
            notify("Stock item saved");
            stock.reload();
          }}
        />
      )}
      {adjust && (
        <FormModal
          title={`Adjust ${adjust.name}`}
          description={`Current quantity: ${adjust.quantity} ${adjust.unit}. Enter a positive addition or a negative deduction. For a stock count, enter counted quantity minus current quantity.`}
          onClose={() => setAdjust(null)}
          initial={{ delta: "", reason: "" }}
          fields={[
            {
              name: "delta",
              label: `Change (${adjust.unit})`,
              type: "number",
              step: adjust.unit === "units" ? "1" : "0.001",
            },
            {
              name: "reason",
              label: "Reason",
              type: "textarea",
              required: true,
            },
          ]}
          submit="Record adjustment"
          onSave={async (v) => {
            await post(`/api/inventory/items/${adjust.id}/adjust/`, v);
            notify("Stock adjusted");
            stock.reload();
          }}
        />
      )}
      {history && (
        <StockHistory item={history} onClose={() => setHistory(null)} />
      )}
    </>
  );
}
function StockHistory({ item, onClose }) {
  const { data, error, loading } = useResource(
    `/api/inventory/adjustments/?item=${item.id}`,
  );
  return (
    <Modal title={`${item.name} · Stock history`} wide onClose={onClose}>
      <div className="modal-body">
        <ErrorBox error={error} />
        {loading ? (
          <Loading />
        ) : data?.length ? (
          <DataTable
            headers={["Date", "Change", "Balance after", "Reason", "Staff"]}
          >
            {data.map((a) => (
              <tr key={a.id}>
                <td>{dateTime(a.created_at)}</td>
                <td
                  className={
                    Number(a.delta) > 0 ? "success-text" : "danger-text"
                  }
                >
                  {Number(a.delta) > 0 ? "+" : ""}
                  {a.delta}
                </td>
                <td>
                  {a.balance_after} {item.unit}
                </td>
                <td>{a.reason}</td>
                <td>#{a.recorded_by}</td>
              </tr>
            ))}
          </DataTable>
        ) : (
          <Empty
            title="No adjustments"
            text="Stock movements will appear here."
          />
        )}
      </div>
    </Modal>
  );
}
