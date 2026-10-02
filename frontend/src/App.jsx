import React, { useState, useEffect, createContext, useContext } from "react";
import {
  HashRouter,
  Routes,
  Route,
  NavLink,
  Navigate,
  useNavigate,
} from "react-router-dom";
import {
  LayoutDashboard,
  UtensilsCrossed,
  ClipboardList,
  ChefHat,
  BookOpen,
  Wallet,
  Package,
  Users,
  LogOut,
  Menu as MenuIcon,
  ArrowRight,
  ShieldCheck,
  Store,
} from "lucide-react";
import { request, post, csrf, setToken } from "./api";
import { canManage, canSell, canCook, today } from "./utils";
import { Button, Field, ErrorBox, Loading } from "./ui";
import Dashboard from "./pages/Dashboard";
import POS from "./pages/POS";
import Orders from "./pages/Orders";
import Kitchen from "./pages/Kitchen";
import MenuPage from "./pages/Menu";
import Finance from "./pages/Finance";
import Inventory from "./pages/Inventory";
import Staff from "./pages/Staff";
const Context = createContext();
export const useApp = () => useContext(Context);
function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">
        C<span>•</span>
      </span>
      <div>
        <strong>MR. COD</strong>
        <small>RESTAURANT WORKSPACE</small>
      </div>
    </div>
  );
}
function Login({ onLogin, initialError }) {
  const [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(initialError);
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await csrf();
      const data = await post("/api/auth/login/", { username, password });
      setToken(data.csrfToken);
      onLogin(data.user);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <section className="login-art">
        <Brand />
        <div className="login-copy">
          <span className="eyebrow">GOOD FOOD. GREAT SERVICE.</span>
          <h1>
            Every order.
            <br />
            Every detail.
            <br />
            <em>All together.</em>
          </h1>
          <p>
            Your counter, kitchen and daily operations.
            <br />
            One workspace, made for your team.
          </p>
        </div>
        <div className="login-stamp">
          <UtensilsCrossed size={68} />
          <span>
            FRESH ORDERS
            <br />
            HAPPY CUSTOMERS
          </span>
        </div>
        <div className="login-bottom">
          MR. COD <span>Single-outlet restaurant management</span>
        </div>
      </section>
      <section className="login-form">
        <div className="login-form-inner">
          <div className="mini-icon">
            <Store size={26} />
          </div>
          <p className="eyebrow">WELCOME BACK</p>
          <h2>Let’s get to work.</h2>
          <p className="muted">Sign in with your restaurant staff account.</p>
          <form onSubmit={submit}>
            <ErrorBox error={error} />
            <Field
              label="Username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              maxLength={150}
            />
            <Field
              label="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              maxLength={256}
            />
            <Button type="submit" busy={busy} className="full">
              Sign in <ArrowRight size={18} />
            </Button>
          </form>
          <p className="login-help">
            <ShieldCheck size={16} />
            Access is based on your assigned role.
          </p>
          <p className="muted small">
            Need an account? Ask your restaurant manager.
          </p>
        </div>
      </section>
    </div>
  );
}
const navigation = [
  {
    path: "/dashboard",
    label: "Overview",
    icon: LayoutDashboard,
    access: canManage,
  },
  {
    path: "/pos",
    label: "Point of sale",
    icon: UtensilsCrossed,
    access: canSell,
  },
  { path: "/orders", label: "Orders", icon: ClipboardList, access: canSell },
  { path: "/kitchen", label: "Kitchen", icon: ChefHat, access: canCook },
  { path: "/menu", label: "Menu & tables", icon: BookOpen, access: canManage },
  { path: "/finance", label: "Cash & expenses", icon: Wallet, access: canSell },
  { path: "/inventory", label: "Inventory", icon: Package, access: canManage },
  { path: "/staff", label: "Team", icon: Users, access: canManage },
];
function Workspace({ user, onLogout }) {
  const [collapsed, setCollapsed] = useState(false),
    [toast, setToast] = useState(""),
    [logoutError, setLogoutError] = useState(null),
    [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({
    type: "dine_in",
    table: "",
    notes: "",
    items: [],
  });
  const home = canManage(user)
    ? "/dashboard"
    : canSell(user)
      ? "/pos"
      : "/kitchen";
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 5000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  useEffect(() => {
    function guard(e) {
      if (draft.items.length) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [draft.items.length]);
  async function logout() {
    if (
      draft.items.length &&
      !window.confirm("Discard the unsaved order and sign out?")
    )
      return;
    setBusy(true);
    try {
      await post("/api/auth/logout/");
      setToken(null);
      onLogout();
    } catch (e) {
      setLogoutError(e);
    } finally {
      setBusy(false);
    }
  }
  if (!canManage(user) && !canSell(user) && !canCook(user)) {
    return (
      <div className="boot">
        <section className="panel panel-body">
          <h2>No restaurant role assigned</h2>
          <p className="muted">
            Ask your manager to assign a Manager, Cashier or Kitchen role.
          </p>
          <ErrorBox error={logoutError} />
          <Button onClick={logout} busy={busy}>
            Sign out
          </Button>
        </section>
      </div>
    );
  }
  return (
    <Context.Provider value={{ user, notify: setToast, draft, setDraft }}>
      <div className={`workspace ${collapsed ? "nav-open" : ""}`}>
        <aside className="sidebar">
          <Brand />
          <div className="outlet">
            <span className="outlet-dot" />
            <div>
              <strong>Main outlet</strong>
              <small>Restaurant operations</small>
            </div>
          </div>
          <div className="nav-caption">WORKSPACE</div>
          <nav>
            {navigation
              .filter((n) => n.access(user))
              .map((n) => (
                <NavLink
                  to={n.path}
                  key={n.path}
                  onClick={() => setCollapsed(false)}
                >
                  <n.icon size={19} />
                  {n.label}
                  <span className="nav-active-dot" />
                </NavLink>
              ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="shift-note">
              <span>Made for a smooth service.</span>
              <strong>
                LET’S SERVE
                <br />
                SOMETHING GREAT.
              </strong>
            </div>
            <button className="logout" onClick={logout} disabled={busy}>
              <LogOut size={17} />
              Sign out
            </button>
          </div>
        </aside>
        <div className="workspace-main">
          <header className="topbar">
            <div className="top-left">
              <button
                className="icon-btn mobile-toggle"
                aria-label="Toggle navigation"
                onClick={() => setCollapsed(!collapsed)}
              >
                <MenuIcon />
              </button>
              <span className="top-title">Restaurant workspace</span>
              <span className="top-date">
                {new Intl.DateTimeFormat("en-PK", {
                  dateStyle: "full",
                  timeZone: "Asia/Karachi",
                }).format(new Date())}
              </span>
            </div>
            <div className="user-chip">
              <div className="avatar">
                {user.username.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <strong>{user.username}</strong>
                <small>
                  {user.is_superuser ? "Administrator" : user.roles.join(" · ")}
                </small>
              </div>
            </div>
          </header>
          <main className="main">
            <ErrorBox error={logoutError} />
            <Routes>
              <Route path="/" element={<Navigate to={home} replace />} />
              {canManage(user) && (
                <Route path="/dashboard" element={<Dashboard />} />
              )}{" "}
              {canSell(user) && (
                <>
                  <Route path="/pos" element={<POS />} />
                  <Route path="/orders" element={<Orders />} />
                  <Route path="/finance" element={<Finance />} />
                </>
              )}
              {canCook(user) && <Route path="/kitchen" element={<Kitchen />} />}{" "}
              {canManage(user) && (
                <>
                  <Route path="/menu" element={<MenuPage />} />
                  <Route path="/inventory" element={<Inventory />} />
                  <Route path="/staff" element={<Staff />} />
                </>
              )}
              <Route path="*" element={<Navigate to={home} replace />} />
            </Routes>
          </main>
        </div>
        {toast && (
          <div role="status" className="toast">
            <ShieldCheck size={18} />
            {toast}
          </div>
        )}
      </div>
    </Context.Provider>
  );
}
export default function App() {
  const [user, setUser] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(null);
  useEffect(() => {
    const expired = () => {
      setToken(null);
      setUser(null);
      if (user)
        setError(new Error("Your session ended. Please sign in again."));
    };
    window.addEventListener("session-expired", expired);
    return () => window.removeEventListener("session-expired", expired);
  }, [user]);
  useEffect(() => {
    request("/api/auth/me/")
      .then(setUser)
      .catch((e) => {
        if (e.status !== 403) setError(e);
      })
      .finally(() => setLoading(false));
  }, []);
  if (loading)
    return (
      <div className="boot">
        <Loading />
      </div>
    );
  return (
    <HashRouter>
      {user ? (
        <Workspace user={user} onLogout={() => setUser(null)} />
      ) : (
        <Login onLogin={setUser} initialError={error} />
      )}
    </HashRouter>
  );
}
