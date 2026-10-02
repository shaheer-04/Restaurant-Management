# MR. COD restaurant frontend

A complete React frontend for the consolidated Django backend from this conversation. The interface follows the menu's royal blue and yellow theme, with desktop, tablet and mobile layouts. Screens use your real backend data; no fake revenue or live-looking sample orders are shipped.

## Install on Windows

1. Install Node.js 22.12+ or Node.js 24 if needed. Check `node --version` and `npm --version` in a fresh Command Prompt.
2. Extract the ZIP. Copy the contents of its `frontend` folder into `E:\Restaurant-management\frontend`. Keep `backend` separate.
3. Open two Command Prompt windows.

**Window 1 — backend**

```bat
cd /d E:\Restaurant-management\backend
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe manage.py check
.venv\Scripts\python.exe manage.py migrate
.venv\Scripts\python.exe manage.py setup_roles
.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000
```

This installation command also resolves the missing `corsheaders` package reported earlier. If it fails, fix the installation error before starting the frontend.

**Window 2 — frontend**

```bat
cd /d E:\Restaurant-management\frontend
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**. Use your existing Django username and password. No new frontend account or database is needed. A superuser sees all screens; ordinary staff see only their assigned role's screens.

Keep both terminal windows running. No `.env` is required for the default local setup. The included `.env.example` documents optional connection settings. Use port 5173: it is already trusted by your backend. Vite proxies `/api/...` to Django; session cookies and CSRF requests stay on the frontend origin.

## First-use workflow

1. Manager: use **Menu & tables** to create active categories, available menu items and tables.
2. Manager: use **Team** to create Cashier and Kitchen users. They are normal users, not Django admin staff.
3. Cashier/Manager: open **Cash & expenses**, choose today, and open the register with the start-of-day cash float.
4. In **Point of sale**, choose Dine-in plus a free table, Takeaway, or Delivery. Add menu items, quantities and notes; click **Create order**.
5. In the order dialog, click **Send to kitchen**.
6. Kitchen staff: open **Kitchen**, then **Start preparing** and **Mark ready**. Tickets refresh every five seconds while the tab is visible.
7. Cashier: in **Orders**, open the Ready order, select **Checkout**, calculate the final bill, and record confirmed payment. Open the receipt and print using the browser.
8. Record expenses and manual stock adjustments as needed.
9. At end of day, count cash and close the register. Closing is final through this MVP; do it only after all intended transactions are recorded.

For receipt printing select 80mm roll, 100% scale, and turn browser headers/footers off. Physical printing still requires testing on your device.

## Included screens

- Login/logout and session restoration, CSRF handling and role-based navigation.
- Manager overview: actual daily collections, expenses, payment breakdown, current order counts, low stock.
- POS: menu search/category filters, stock availability, table selection, quantity controls, item and order notes.
- Orders: status filters, pending-order editing, cancellation with reasons, additions, kitchen submission, audit history, checkout and receipt access.
- Kitchen: status columns, notes, elapsed time and periodic refresh.
- Menu and tables: add/edit categories, items, availability, prices, table capacity and status.
- Finance: date selection, register opening/closing, cash difference, saved-day summaries, paginated expenses and manager-only voiding.
- Inventory: stock item metadata, low-stock thresholds, positive/negative adjustments, history.
- Team: account creation, role assignment, password update and activation/deactivation.

## Existing backend limits remain

- One outlet and one register per Pakistan calendar day; one full payment per order.
- Pending orders can be edited. Once cooking starts, additional kitchen batches are not supported.
- Payment screens record money already received; they do not charge a card or wallet.
- Manual ingredient inventory; no recipe-based stock deduction, suppliers/purchase orders, refunds or split bills.
- Cash expenses come from the drawer; cash top-ups, withdrawals, separate petty cash and shifts crossing midnight are not modeled.
- Financial operating summary is not accounting profit; no inventory valuation/accrual accounting.
- The POS draft survives in-app page navigation but not a browser refresh or logout. Refreshing with a draft triggers a browser warning. An order created on the server is available under Orders.
- Network failures after a write are treated as uncertain. Check the relevant list before repeating a create/adjustment request. The UI disables repeated submission; checkout has a safe same-payload retry.

## Troubleshooting

- **Cannot reach server:** check Django is running on 127.0.0.1:8000 and the frontend is on 127.0.0.1:5173.
- **403 / CSRF:** sign out/in, use the same host spelling, keep cookies enabled and retain the backend's FRONTEND_ORIGINS defaults. Clear old cookies if switching between localhost and 127.0.0.1.
- **Register error:** open today's register before recording payments/expenses. Closed dates cannot receive further entries.
- **No menu items:** activate categories and create available items under Menu & tables.
- **Port 5173 busy:** close the old dev server. Vite intentionally does not switch ports because Django trusts specific origins.
- **npm ci fails:** ensure package.json and package-lock.json were copied together and Node meets the requirement. Send the npm installation output, not only a later app error.

## Build and checks

```bat
npm test
npm run build
```

Production files are generated in `dist`. Deploy them with a real same-origin reverse proxy for `/api/` to Django. Vite's development proxy does not exist in static hosting. Configure HTTPS and Django host/security settings before deployment. Hash-based routing avoids static-host route-rewrite requirements. If you use separate frontend/backend origins, set VITE_API_BASE before build and configure explicit CORS/CSRF origins and compatible cookie policies.

Optional browser tests are described in `TEST_REPORT.md`. Do not run their write/closing workflow against real restaurant data.
