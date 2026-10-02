const { expect } = require("@playwright/test");
const { chromium } = require("playwright");
const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}
test.skip = (condition, message) => {
  if (condition) {
    console.error(message);
    process.exit(1);
  }
};
const password = process.env.E2E_PASSWORD,
  manager = process.env.E2E_MANAGER,
  cashier = process.env.E2E_CASHIER,
  kitchen = process.env.E2E_KITCHEN;
test.skip(
  !password || !manager || !cashier || !kitchen,
  "Supply E2E accounts for an isolated backend. Tests create and close financial records.",
);
async function login(page, name) {
  await page.goto("/");
  await page.getByLabel("Username", { exact: true }).fill(name);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}
async function go(page, name) {
  await page
    .getByRole("navigation")
    .getByRole("link", { name, exact: true })
    .click();
}
test("Complete manager order, payment, expense, inventory and closing workflow", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page, manager);
  await expect(
    page.getByRole("heading", { name: "A good day starts here." }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/overview.png", fullPage: true });
  await go(page, "Cash & expenses");
  await page
    .getByRole("button", { name: "Open register", exact: true })
    .click();
  let d = page.getByRole("dialog");
  await d.getByLabel("Opening cash (PKR)").fill("5000");
  await d.getByRole("button", { name: "Open register", exact: true }).click();
  await expect(d).toHaveCount(0);
  await go(page, "Point of sale");
  await page.getByRole("button", { name: "Takeaway", exact: true }).click();
  await page.getByRole("button", { name: /B01.*Tower Burger/ }).click();
  await page.screenshot({ path: "test-results/pos.png", fullPage: true });
  await page.getByRole("button", { name: "Create order", exact: true }).click();
  d = page.getByRole("dialog");
  await expect(d.getByRole("heading", { name: /Order #/ })).toBeVisible();
  const title = await d.getByRole("heading").first().textContent();
  const id = title.match(/#(\d+)/)[1];
  await d.getByRole("button", { name: "Send to kitchen", exact: true }).click();
  await expect(
    d.getByText("Sent to kitchen · waiting for preparation"),
  ).toBeVisible();
  await d.getByLabel("Close dialog").click();
  await go(page, "Kitchen");
  await page
    .getByRole("button", { name: "Start preparing", exact: true })
    .click();
  await page.getByRole("button", { name: "Mark ready", exact: true }).click();
  await expect(page.getByText("Ready for service & checkout")).toBeVisible();
  await go(page, "Orders");
  await page
    .getByRole("button", { name: "View order", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Checkout", exact: true }).click();
  d = page.getByRole("dialog").last();
  await d.getByRole("button", { name: "Calculate final bill" }).click();
  await d.getByLabel("Amount received").fill("1000");
  await d.getByRole("button", { name: "Record payment & complete" }).click();
  await expect(page.getByRole("link", { name: "Open receipt" })).toBeVisible();
  const receipt = await page
    .context()
    .request.get(`/api/payments/orders/${id}/receipt/`);
  expect(receipt.status()).toBe(200);
  expect(await receipt.text()).toContain("699.00");
  await page.getByRole("dialog").getByLabel("Close dialog").click();
  await go(page, "Cash & expenses");
  await page
    .getByRole("button", { name: "Record expense", exact: true })
    .click();
  d = page.getByRole("dialog");
  await d.getByLabel("Description", { exact: true }).fill("Test oil purchase");
  await d.getByLabel("Amount (PKR)").fill("100");
  await d.getByRole("button", { name: "Record expense", exact: true }).click();
  await expect(d).toHaveCount(0);
  await expect(
    page.getByText("Test oil purchase", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Void", exact: true }).click();
  d = page.getByRole("dialog");
  await d.getByLabel("Reason", { exact: true }).fill("Test correction");
  await d.getByRole("button", { name: "Void expense", exact: true }).click();
  await expect(d).toHaveCount(0);
  await expect(page.getByText("Voided", { exact: true })).toBeVisible();
  await go(page, "Inventory");
  await page
    .getByRole("button", { name: "Adjust", exact: true })
    .first()
    .click();
  d = page.getByRole("dialog");
  await d.getByLabel("Change (kg)").fill("5");
  await d.getByLabel("Reason", { exact: true }).fill("Test delivery");
  await d.getByRole("button", { name: "Record adjustment" }).click();
  await expect(d).toHaveCount(0);
  await expect(page.getByText("8.000 kg", { exact: true })).toBeVisible();
  await go(page, "Menu & tables");
  await expect(page.getByText("Tower Burger", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Tables", exact: true }).click();
  await expect(page.getByText("Table 1", { exact: true })).toBeVisible();
  await go(page, "Team");
  await page.getByRole("button", { name: "Add team member" }).click();
  d = page.getByRole("dialog");
  await d.getByLabel("Username", { exact: true }).fill("browsercreated");
  await d.getByLabel("Password", { exact: true }).fill("Browser-Strong-728!");
  await d.getByRole("button", { name: "Save", exact: true }).click();
  await expect(d).toHaveCount(0);
  await expect(
    page.getByRole("cell", { name: /browsercreated/ }),
  ).toBeVisible();
  await go(page, "Cash & expenses");
  await page
    .getByRole("button", { name: "Close register", exact: true })
    .click();
  d = page.getByRole("dialog");
  await d.getByLabel("Counted cash (PKR)").fill("5699");
  await d.getByRole("button", { name: "Confirm & close day" }).click();
  await expect(d).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Day closed & recorded" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("Cashier route protection", async ({ page }) => {
  await login(page, cashier);
  await expect(
    page.getByRole("heading", { name: "Let’s take an order." }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation")
      .getByRole("link", { name: "Team", exact: true }),
  ).toHaveCount(0);
  await expect(
    page
      .getByRole("navigation")
      .getByRole("link", { name: "Kitchen", exact: true }),
  ).toHaveCount(0);
  await page.goto("/#/inventory");
  await expect(
    page.getByRole("heading", { name: "Let’s take an order." }),
  ).toBeVisible();
});
test("Kitchen route protection", async ({ page }) => {
  await login(page, kitchen);
  await expect(
    page.getByRole("heading", { name: "Fresh tickets. Clear focus." }),
  ).toBeVisible();
  await expect(page.getByRole("navigation").getByRole("link")).toHaveCount(1);
});
test("Mobile layout and navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, manager);
  await expect(
    page.getByRole("heading", { name: "A good day starts here." }),
  ).toBeVisible();
  await page.getByLabel("Toggle navigation").click();
  await go(page, "Point of sale");
  await expect(
    page.getByRole("heading", { name: "Let’s take an order." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
});
test("Tablet layout", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await login(page, cashier);
  await expect(
    page.getByRole("heading", { name: "Let’s take an order." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});

(async () => {
  require("node:fs").mkdirSync("test-results", { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {}),
  });
  let passed = 0;
  try {
    for (const t of tests) {
      const context = await browser.newContext({
        baseURL: process.env.E2E_BASE_URL || "http://127.0.0.1:5173",
        viewport: { width: 1440, height: 1000 },
      });
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      console.log("RUN", t.name);
      try {
        await t.fn({ page });
        passed++;
        console.log("PASS", t.name);
      } catch (e) {
        await page.screenshot({
          path: "test-results/failure.png",
          fullPage: true,
        });
        console.error(e);
        process.exitCode = 1;
        break;
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
    console.log(`${passed}/${tests.length} browser workflows passed`);
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
