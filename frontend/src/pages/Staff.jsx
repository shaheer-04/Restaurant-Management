import React, { useState } from "react";
import { Plus, Users } from "lucide-react";
import { useApp } from "../App";
import { post, patch } from "../api";
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
export default function Staff() {
  const { data, error, loading, reload } = useResource("/api/auth/staff/");
  const [edit, setEdit] = useState(null);
  const { notify, user } = useApp();
  return (
    <>
      <PageHead
        title="Your team"
        description="The right access for everyone behind the counter."
      >
        <Refresh onClick={reload} />
        <Button onClick={() => setEdit({})}>
          <Plus size={17} />
          Add team member
        </Button>
      </PageHead>
      <div className="role-cards">
        {[
          {
            role: "Manager",
            text: "Menu, finance, inventory and team management.",
          },
          {
            role: "Cashier",
            text: "Orders, payments, cash register and expenses.",
          },
          { role: "Kitchen", text: "Kitchen tickets and preparation status." },
        ].map((r) => (
          <div className="panel role-card" key={r.role}>
            <Users size={20} />
            <h3>{r.role}</h3>
            <p>{r.text}</p>
          </div>
        ))}
      </div>
      <ErrorBox error={error} />
      <section className="panel">
        {loading ? (
          <Loading />
        ) : data?.length ? (
          <DataTable headers={["Team member", "Role", "Status", ""]}>
            {data.map((u) => (
              <tr key={u.id}>
                <td>
                  <strong>
                    {u.first_name || u.username} {u.last_name}
                  </strong>
                  <small>
                    {u.username}
                    {u.email ? ` · ${u.email}` : ""}
                  </small>
                </td>
                <td>{u.roles.join(", ") || "No role"}</td>
                <td>
                  <Badge value={u.is_active ? "active" : "inactive"} />
                </td>
                <td>
                  <Button variant="secondary" onClick={() => setEdit(u)}>
                    Edit
                  </Button>
                </td>
              </tr>
            ))}
          </DataTable>
        ) : (
          <Empty
            title="Build your team"
            text="Create staff accounts to get everyone connected. Django admin accounts are managed separately."
          />
        )}
      </section>
      {edit && (
        <FormModal
          title={edit.id ? "Edit team member" : "Add team member"}
          onClose={() => setEdit(null)}
          description={
            edit.id
              ? "Leave the password empty to keep it unchanged."
              : "Assign one role and a strong password. Staff can sign in immediately."
          }
          initial={{
            username: "",
            email: "",
            first_name: "",
            last_name: "",
            password: "",
            ...edit,
            role: edit.roles?.[0] || "Cashier",
            is_active: edit.id ? String(edit.is_active) : "true",
          }}
          fields={[
            { name: "username", label: "Username", maxLength: 150 },
            {
              name: "first_name",
              label: "First name",
              required: false,
              maxLength: 150,
            },
            {
              name: "last_name",
              label: "Last name",
              required: false,
              maxLength: 150,
            },
            { name: "email", label: "Email", type: "email", required: false },
            {
              name: "role",
              label: "Role",
              type: "select",
              hidden: edit.id === user.id,
              options: ["Manager", "Cashier", "Kitchen"].map((v) => ({
                value: v,
                label: v,
              })),
            },
            {
              name: "is_active",
              label: "Status",
              type: "select",
              hidden: edit.id === user.id,
              options: [
                { value: "true", label: "Active" },
                { value: "false", label: "Inactive" },
              ],
            },
            {
              name: "password",
              label: edit.id ? "New password (optional)" : "Password",
              type: "password",
              required: !edit.id,
              maxLength: 256,
            },
          ]}
          onSave={async (v) => {
            const body = {
              username: v.username,
              email: v.email,
              first_name: v.first_name,
              last_name: v.last_name,
              ...(edit.id !== user.id
                ? { role: v.role, is_active: v.is_active === "true" }
                : {}),
              ...(v.password ? { password: v.password } : {}),
            };
            if (edit.id) await patch(`/api/auth/staff/${edit.id}/`, body);
            else await post("/api/auth/staff/", body);
            notify("Team member saved");
            reload();
          }}
        />
      )}
    </>
  );
}
