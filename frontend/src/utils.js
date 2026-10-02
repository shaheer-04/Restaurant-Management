export const money = (value) =>
  new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
export const amount = (value) =>
  new Intl.NumberFormat("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
export function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export const dateTime = (value) =>
  value
    ? new Intl.DateTimeFormat("en-PK", {
        timeZone: "Asia/Karachi",
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";
export const label = (value) =>
  String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
export function cents(value) {
  const [a, b = ""] = String(value).split(".");
  return Number(a) * 100 + Number(b.padEnd(2, "0").slice(0, 2));
}
export function cartTotal(items) {
  return (
    items.reduce((sum, item) => sum + cents(item.price) * item.quantity, 0) /
    100
  );
}
export function flattenErrors(value, prefix = "") {
  if (typeof value === "string")
    return `${prefix ? prefix + ": " : ""}${value}`;
  if (Array.isArray(value))
    return value.map((v) => flattenErrors(v, prefix)).join(" ");
  if (value && typeof value === "object")
    return Object.entries(value)
      .map(([k, v]) =>
        flattenErrors(
          v,
          k === "detail" || k === "non_field_errors"
            ? prefix
            : k.replaceAll("_", " "),
        ),
      )
      .join(" ");
  return "Request failed. Please check the entered values.";
}
export const canManage = (user) =>
  user?.is_superuser || user?.roles?.includes("Manager");
export const canSell = (user) =>
  canManage(user) || user?.roles?.includes("Cashier");
export const canCook = (user) =>
  canManage(user) || user?.roles?.includes("Kitchen");
