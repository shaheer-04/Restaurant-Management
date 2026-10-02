# Frontend verification — 2 October 2026

## Passed

- Production compilation (`npm run build`) using Vite 7.3.6.
- Nine unit tests (`npm test`): decimal cart totals, empty cart, manager/cashier/kitchen/superuser access rules, API error formatting, Pakistan date formatting and readable backend labels.
- Backend endpoint and serializer shapes were read from the updated Django project when wiring the screens.
- The temporary Django integration database migrated successfully and the frontend proxy successfully retrieved a real CSRF token from Django.

## Not verified here

Full browser interaction could not run. Chromium was downloaded, but the execution environment denied the socket required to launch it. No browser workflow, screenshot, mobile rendering, live payment flow, physical printer or PostgreSQL concurrency result is claimed as passed.

The supplied browser checks cover an order-to-payment workflow, manager expense voiding, stock adjustment, staff creation, day closing, cashier/kitchen navigation restrictions, and mobile/tablet viewport overflow. Run them only against a disposable test backend. They create and close financial records.

## Optional end-to-end tests

1. Create a separate test installation/database of the consolidated Django backend. Never use the live restaurant database.
2. Create three users with Manager, Cashier and Kitchen roles, using the same temporary test password. Create a Burgers category with an available item named `Tower Burger`, short code `B01`, price `699.00`; a table numbered 1; and an active stock item named `Chicken`, unit `kg`, quantity `3.000`. The test expects an empty register for today, no active orders and no staff user named `browsercreated`. Use tax rate 0.00 for this fixture.
3. Start the isolated backend and frontend on the documented ports. Then, in the frontend terminal:

```bat
npx playwright install chromium
set E2E_MANAGER=your_test_manager_username
set E2E_CASHIER=your_test_cashier_username
set E2E_KITCHEN=your_test_kitchen_username
set E2E_PASSWORD=your_temporary_test_password
npm run test:e2e
```

The script outputs PASS/FAIL and saves screenshots under test-results. It deliberately stops at the first failed workflow. Restore an empty test database before repeating the write workflow. Test credentials come only from environment variables; no working account passwords are included in the package.

## Manual acceptance checklist on your machine

- Login as each role; verify restricted screens and backend permissions.
- Create categories/items/tables and a staff account through the UI.
- Open today's register, create an order, edit a pending line, send it to kitchen, prepare, mark Ready, calculate a bill and record payment.
- Open/print the receipt. Verify saved amounts and change.
- Record and void an expense; verify report totals.
- Add and deduct stock; verify history and negative-stock rejection.
- Close the register; confirm further payments/expenses are blocked.
- Refresh the browser while signed in; confirm the session restores.
- Disconnect the backend and check error messages. Never repeat an uncertain financial write without checking its result.
- Verify 1024px tablet and your actual workstation layouts, and keyboard navigation.
- Run the backend's separate PostgreSQL concurrency tests before operational use.

## Design and implementation notes

React + Vite; no frontend secrets. Hash routes, session cookie authentication, CSRF token rotation at login. API writes are not automatically retried. Kitchen polls every five seconds only when visible. Fonts optionally load from Google Fonts with local fallbacks; food illustrations use bundled Lucide icons rather than external photos.
