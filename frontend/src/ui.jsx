import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  X,
  RefreshCw,
  Inbox,
  AlertCircle,
  LoaderCircle,
  Plus,
} from "lucide-react";
import { request } from "./api";
import { label, money } from "./utils";
export function Button({
  children,
  variant = "",
  busy = false,
  className = "",
  ...props
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || busy}
      className={`btn ${variant} ${className}`}
    >
      {busy ? <LoaderCircle size={17} className="spin" /> : null}
      {children}
    </button>
  );
}
export function Badge({ value }) {
  return <span className={`badge ${value}`}>{label(value)}</span>;
}
export function ErrorBox({ error }) {
  return error ? (
    <div role="alert" className="error">
      <AlertCircle size={18} />
      <span>
        {error.message || String(error)}
        {error.uncertain && (
          <strong>
            {" "}
            Do not repeat this action until you verify its result.
          </strong>
        )}
      </span>
    </div>
  ) : null;
}
export function Empty({
  title = "Nothing here yet",
  text = "New records will appear here.",
  children,
}) {
  return (
    <div className="empty">
      <Inbox size={32} />
      <h3>{title}</h3>
      <p>{text}</p>
      {children}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={22} /> Loading workspace…
    </div>
  );
}
export function PageHead({ eyebrow, title, description, children }) {
  return (
    <header className="page-head">
      <div>
        <div className="eyebrow">{eyebrow || "RESTAURANT WORKSPACE"}</div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      <div className="head-actions">{children}</div>
    </header>
  );
}
export function Field({ label: caption, children, hint, ...props }) {
  return (
    <label className="field">
      <span>{caption}</span>
      {children || <input {...props} />} {hint && <small>{hint}</small>}
    </label>
  );
}
export function Select({ label: caption, options, ...props }) {
  return (
    <Field label={caption}>
      <select {...props}>
        {options.map((o) => (
          <option key={String(o.value)} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
export function Stat({
  label: caption,
  value,
  icon: Icon,
  small,
  accent = false,
}) {
  return (
    <div className={`stat ${accent ? "accent" : ""}`}>
      <div className="stat-top">
        <span>{caption}</span>
        {Icon && <Icon size={19} />}
      </div>
      <strong>{value}</strong>
      {small && <small>{small}</small>}
    </div>
  );
}
export function MoneyRow({ label: caption, value, total = false }) {
  return (
    <div className={`money-row ${total ? "total" : ""}`}>
      <span>{caption}</span>
      <strong>{money(value)}</strong>
    </div>
  );
}
export function Modal({
  title,
  onClose,
  children,
  wide = false,
  locked = false,
}) {
  const ref = useRef();
  useEffect(() => {
    const el = ref.current;
    el.showModal();
    return () => el.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      onCancel={(e) => {
        e.preventDefault();
        if (!locked) onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button
          disabled={locked}
          className="icon-btn"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={21} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function useResource(path, interval = 0) {
  const [data, setData] = useState(null),
    [error, setError] = useState(null),
    [loading, setLoading] = useState(true);
  const ref = useRef(0),
    mounted = useRef(true);
  const reload = useCallback(async () => {
    const n = ++ref.current;
    try {
      const result = await request(path);
      if (mounted.current && n === ref.current) {
        setData(result);
        setError(null);
      }
      return result;
    } catch (e) {
      if (mounted.current && n === ref.current) setError(e);
      return null;
    } finally {
      if (mounted.current && n === ref.current) setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    let active = true;
    mounted.current = true;
    setLoading(true);
    setData(null);
    reload();
    let timer;
    if (interval) {
      const poll = async () => {
        if (!active) return;
        if (!document.hidden) await reload();
        if (active) timer = setTimeout(poll, interval);
      };
      timer = setTimeout(poll, interval);
    }
    return () => {
      active = false;
      mounted.current = false;
      ref.current++;
      clearTimeout(timer);
    };
  }, [reload, interval]);
  return { data, error, loading, reload };
}
export function Refresh({ onClick }) {
  return (
    <Button variant="secondary" onClick={onClick}>
      <RefreshCw size={16} />
      Refresh
    </Button>
  );
}
export function FormModal({
  title,
  fields,
  initial = {},
  onClose,
  onSave,
  submit = "Save",
  description,
}) {
  const [values, setValues] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null);
  const lock = useRef(false);
  async function save(e) {
    e.preventDefault();
    if (lock.current || error?.uncertain) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await onSave(values);
      onClose();
    } catch (e) {
      setError(e);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Modal title={title} onClose={onClose} locked={busy}>
      <form onSubmit={save}>
        <div className="modal-body">
          {description && <p className="muted">{description}</p>}
          <ErrorBox error={error} />
          <div className="form-grid">
            {fields
              .filter((f) => !f.hidden)
              .map((f) => (
                <Field key={f.name} label={f.label} hint={f.hint}>
                  {f.type === "select" ? (
                    <select
                      required={f.required !== false}
                      value={values[f.name] ?? ""}
                      onChange={(e) =>
                        setValues({ ...values, [f.name]: e.target.value })
                      }
                    >
                      {f.options.map((o) => (
                        <option key={String(o.value)} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : f.type === "textarea" ? (
                    <textarea
                      maxLength={f.maxLength || 500}
                      required={f.required}
                      value={values[f.name] ?? ""}
                      onChange={(e) =>
                        setValues({ ...values, [f.name]: e.target.value })
                      }
                    />
                  ) : (
                    <input
                      type={f.type || "text"}
                      min={f.min}
                      max={f.max}
                      step={f.step}
                      maxLength={f.maxLength || 255}
                      autoComplete={
                        f.type === "password" ? "new-password" : undefined
                      }
                      required={f.required !== false}
                      value={values[f.name] ?? ""}
                      onChange={(e) =>
                        setValues({ ...values, [f.name]: e.target.value })
                      }
                    />
                  )}
                </Field>
              ))}
          </div>
        </div>
        <footer className="modal-foot">
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button type="submit" busy={busy} disabled={error?.uncertain}>
            {submit}
          </Button>
        </footer>
      </form>
    </Modal>
  );
}
export function DataTable({ headers, children }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
export const plus = <Plus size={17} />;
