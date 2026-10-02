import { flattenErrors } from "./utils";
export const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(
  /\/$/,
  "",
);
let token = null;
export class ApiError extends Error {
  constructor(message, status = 0, uncertain = false) {
    super(message);
    this.status = status;
    this.uncertain = uncertain;
  }
}
export function setToken(value) {
  token = value;
}
export async function csrf() {
  const response = await request("/api/auth/csrf/");
  token = response.csrfToken;
  return token;
}
export async function request(path, { method = "GET", body, signal } = {}) {
  const writing = !["GET", "HEAD", "OPTIONS"].includes(method);
  if (writing && !token) await csrf();
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      credentials: "include",
      signal,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(writing ? { "X-CSRFToken": token } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (e) {
    if (e.name === "AbortError") throw e;
    throw new ApiError(
      writing
        ? "Connection lost. The action may have completed. Refresh the relevant list before trying again."
        : "Cannot reach the server. Check that Django and the frontend are running.",
      0,
      writing,
    );
  }
  let data;
  const raw = await response.text();
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }
  if (!response.ok) {
    if (
      response.status === 403 &&
      /authentication credentials|not authenticated/i.test(data?.detail || "")
    )
      window.dispatchEvent(new Event("session-expired"));
    const uncertain = writing && response.status >= 500;
    throw new ApiError(
      data
        ? flattenErrors(data)
        : response.status === 403
          ? "Access denied or session expired. Sign in again."
          : `Server returned ${response.status}. Check the Django terminal.`,
      response.status,
      uncertain,
    );
  }
  if (data === null && raw)
    throw new ApiError(
      "The server returned an unexpected response.",
      response.status,
      writing,
    );
  return data;
}
export const post = (path, body = {}) =>
  request(path, { method: "POST", body });
export const patch = (path, body) => request(path, { method: "PATCH", body });
export const receiptURL = (id) =>
  `${API_BASE}/api/payments/orders/${id}/receipt/`;
export async function list(path, signal) {
  const data = await request(path, { signal });
  return Array.isArray(data) ? data : data.results || [];
}
