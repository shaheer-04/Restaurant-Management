import React, { useState } from "react";
import { Plus, Search } from "lucide-react";
import { useApp } from "../App";
import { post, patch } from "../api";
import { money } from "../utils";
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
} from "../ui";
const yesNo = [
  { value: "true", label: "Active" },
  { value: "false", label: "Inactive" },
];
export default function MenuPage() {
  const [tab, setTab] = useState("items"),
    [edit, setEdit] = useState(null),
    [query, setQuery] = useState("");
  const items = useResource("/api/menu/items/"),
    categories = useResource("/api/menu/categories/"),
    tables = useResource("/api/orders/tables/");
  const { notify } = useApp();
  const resources = { items, categories, tables };
  const current = resources[tab];
  const rows = (current.data || []).filter((v) =>
    `${v.name || v.table_number} ${v.short_code || ""}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  function fields() {
    if (tab === "categories")
      return [
        { name: "name", label: "Category name", maxLength: 100 },
        { name: "is_active", label: "Status", type: "select", options: yesNo },
      ];
    if (tab === "tables")
      return [
        {
          name: "table_number",
          label: "Table number",
          type: "number",
          min: 1,
          step: 1,
        },
        { name: "capacity", label: "Seats", type: "number", min: 1, step: 1 },
        { name: "is_active", label: "Status", type: "select", options: yesNo },
      ];
    return [
      { name: "name", label: "Item name", maxLength: 150 },
      { name: "short_code", label: "Short code", maxLength: 20 },
      {
        name: "category",
        label: "Category",
        type: "select",
        options: [
          { value: "", label: "Choose category" },
          ...(categories.data || []).map((c) => ({
            value: c.id,
            label: c.name,
          })),
        ],
      },
      {
        name: "price",
        label: "Selling price (PKR)",
        type: "number",
        min: 0,
        step: "0.01",
      },
      {
        name: "is_available",
        label: "Availability",
        type: "select",
        options: [
          { value: "true", label: "In stock" },
          { value: "false", label: "Out of stock" },
        ],
      },
    ];
  }
  const url = tab === "tables" ? "/api/orders/tables/" : `/api/menu/${tab}/`;
  return (
    <>
      <PageHead
        title="Menu & tables"
        description="Keep the menu fresh and your floor ready for service."
      >
        <Refresh
          onClick={() => {
            items.reload();
            categories.reload();
            tables.reload();
          }}
        />
        <Button onClick={() => setEdit({})}>
          <Plus size={17} />
          Add{" "}
          {tab === "items"
            ? "item"
            : tab === "categories"
              ? "category"
              : "table"}
        </Button>
      </PageHead>
      <div className="toolbar between">
        <div className="tabs">
          {["items", "categories", "tables"].map((t) => (
            <button
              key={t}
              className={tab === t ? "active" : ""}
              onClick={() => {
                setTab(t);
                setQuery("");
              }}
            >
              {t === "items"
                ? "Menu items"
                : t === "categories"
                  ? "Categories"
                  : "Tables"}
            </button>
          ))}
        </div>
        <div className="search compact">
          <Search size={17} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            aria-label="Search records"
          />
        </div>
      </div>
      <ErrorBox error={current.error} />
      <section className="panel">
        {current.loading ? (
          <Loading />
        ) : !rows.length ? (
          <Empty
            title={`No ${tab} found`}
            text="Add a record to get started."
          />
        ) : tab === "items" ? (
          <DataTable
            headers={["Item", "Category", "Price", "Availability", ""]}
          >
            {rows.map((i) => (
              <tr key={i.id}>
                <td>
                  <strong>{i.name}</strong>
                  <small>{i.short_code}</small>
                </td>
                <td>{i.category_name}</td>
                <td>{money(i.price)}</td>
                <td>
                  <Badge value={i.is_available ? "in_stock" : "out_of_stock"} />
                </td>
                <td>
                  <Button variant="secondary" onClick={() => setEdit(i)}>
                    Edit
                  </Button>
                </td>
              </tr>
            ))}
          </DataTable>
        ) : tab === "categories" ? (
          <DataTable headers={["Category", "Status", ""]}>
            {rows.map((c) => (
              <tr key={c.id}>
                <td>
                  <strong>{c.name}</strong>
                </td>
                <td>
                  <Badge value={c.is_active ? "active" : "inactive"} />
                </td>
                <td>
                  <Button variant="secondary" onClick={() => setEdit(c)}>
                    Edit
                  </Button>
                </td>
              </tr>
            ))}
          </DataTable>
        ) : (
          <div className="table-cards">
            {rows.map((t) => (
              <article
                key={t.id}
                className={`table-card ${t.open_order_id ? "occupied" : ""}`}
              >
                <div>
                  <strong>Table {t.table_number}</strong>
                  <Badge
                    value={
                      !t.is_active
                        ? "inactive"
                        : t.open_order_id
                          ? "occupied"
                          : "available"
                    }
                  />
                </div>
                <span className="table-number">
                  {String(t.table_number).padStart(2, "0")}
                </span>
                <p>
                  {t.capacity} seats
                  {t.open_order_id ? ` · Order #${t.open_order_id}` : ""}
                </p>
                <Button variant="secondary" onClick={() => setEdit(t)}>
                  Edit table
                </Button>
              </article>
            ))}
          </div>
        )}
      </section>
      {edit && (
        <FormModal
          title={`${edit.id ? "Edit" : "Add"} ${tab === "items" ? "menu item" : tab === "categories" ? "category" : "table"}`}
          onClose={() => setEdit(null)}
          fields={fields()}
          initial={{
            name: "",
            short_code: "",
            category: "",
            price: "",
            capacity: 4,
            is_active: "true",
            is_available: "true",
            ...edit,
            ...("is_active" in edit
              ? { is_active: String(edit.is_active) }
              : {}),
            ...("is_available" in edit
              ? { is_available: String(edit.is_available) }
              : {}),
          }}
          onSave={async (v) => {
            const body =
              tab === "items"
                ? {
                    name: v.name,
                    short_code: v.short_code,
                    category: Number(v.category),
                    price: v.price,
                    is_available: v.is_available === "true",
                  }
                : tab === "categories"
                  ? { name: v.name, is_active: v.is_active === "true" }
                  : {
                      table_number: Number(v.table_number),
                      capacity: Number(v.capacity),
                      is_active: v.is_active === "true",
                    };
            if (edit.id) await patch(`${url}${edit.id}/`, body);
            else await post(url, body);
            notify("Saved successfully");
            current.reload();
          }}
        />
      )}
    </>
  );
}
