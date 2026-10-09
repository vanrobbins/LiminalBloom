import { expect, sizeOf, test } from "./fixtures";
import { seedLayout } from "./map-store";
import { seedCatalog } from "./product-store";

test.beforeEach(async () => {
  await seedLayout();
  await seedCatalog();
});

const results = (page: import("@playwright/test").Page) => page.getByRole("main").getByRole("list").first();

async function openPant(page: import("@playwright/test").Page) {
  await page.goto("/search");
  await page.getByRole("main").getByLabel("Search products").fill("e2e hi rise pnt");
  const row = results(page).getByRole("button", { name: /E2E High-Rise Pant/ });
  await expect(row).toContainText("Table 1, A1 · Folded");
  await row.click();
}

test("finds a product through a typo and shows exactly where it goes", async ({ page }) => {
  await openPant(page);
  await expect(page.getByText("Table 1, A1–B2", { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "Table 1: cells A1–B2 of a 6 by 3 grid" })).toBeVisible();
  await expect(page.getByText("Table 1, highlighted on the store map")).toBeVisible();
  await expect(page).toHaveURL(/\?q=e2e\+hi\+rise\+pnt/);
});

test("changes status at once, and Undo puts it back", async ({ page }) => {
  await openPant(page);
  await page.getByRole("radio", { name: "Sold out" }).click();
  await expect(page.getByText("E2E High-Rise Pant: Sold out", { exact: true })).toBeVisible();
  await expect(page.getByRole("radio", { name: "Sold out" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("radio", { name: "In stock" })).toHaveAttribute("aria-checked", "true");
});

test("a status change from a stale screen is refused and shows the current status", async ({ page, browser }) => {
  // Opened from the URL, so the results are server-rendered and no debounced
  // search can land after the first save and quietly refresh the second screen.
  async function openFromUrl(p: import("@playwright/test").Page) {
    await p.goto("/search?q=E2E-HRP-01");
    await results(p).getByRole("button", { name: /E2E High-Rise Pant/ }).click();
    await expect(p.getByRole("radio", { name: "In stock" })).toHaveAttribute("aria-checked", "true");
  }
  // A second device: a new context inherits the project's options, sign-in included.
  const other = await browser.newContext();
  try {
    const otherPage = await other.newPage();
    await openFromUrl(page);
    await openFromUrl(otherPage);

    await page.getByRole("radio", { name: "Sold out" }).click();
    await expect(page.getByText("E2E High-Rise Pant: Sold out", { exact: true })).toBeVisible();

    await otherPage.getByRole("radio", { name: "On sale" }).click();
    await expect(otherPage.getByText("Changed on another device", { exact: true })).toBeVisible();
    await expect(otherPage.getByRole("radio", { name: "Sold out" })).toHaveAttribute("aria-checked", "true");
  } finally {
    await other.close();
  }
});

test("a filter narrows the results", async ({ page }) => {
  await page.goto("/search?q=e2e");
  await expect(results(page).getByRole("button")).toHaveCount(2);
  await page.goto("/search?q=e2e&place=unplaced");
  await expect(results(page).getByRole("button")).toHaveCount(1);
  await expect(results(page)).toContainText("E2E Pocket Tee");
});

test("an unmatched search says so", async ({ page }) => {
  await page.goto("/search?q=zzqqxx");
  await expect(page.getByText("No products match “zzqqxx”.")).toBeVisible();
});

test("search is a bottom tab on phones", async ({ page }) => {
  test.skip(sizeOf(test.info()) !== "phone", "Tabs are the phone's navigation.");
  await page.goto("/products");
  await page.getByRole("navigation", { name: "Main" }).filter({ visible: true }).getByRole("link", { name: "Search" }).click();
  await expect(page).toHaveURL(/\/search$/);
  await expect(page.getByRole("main").getByLabel("Search products")).toBeFocused();
});

test("dragging the location sheet down closes it", async ({ page }) => {
  test.skip(sizeOf(test.info()) !== "phone", "The sheet is the phone's form; wider screens use a panel.");
  await openPant(page);
  const sheet = page.getByRole("dialog", { name: "E2E High-Rise Pant" });
  await expect(sheet).toBeVisible();
  await page.waitForTimeout(600);
  const box = (await sheet.boundingBox())!;
  const x = box.x + box.width / 2;
  await page.mouse.move(x, box.y + 12);
  await page.mouse.down();
  await page.mouse.move(x, box.y + box.height, { steps: 12 });
  await page.mouse.up();
  await expect(sheet).toBeHidden();
});

test("finds a product's cell well inside 10 seconds on a phone", async ({ page }) => {
  test.skip(sizeOf(test.info()) !== "phone", "§1.5 times the phone.");
  // Warm the dev server's compile, which a deployed app does not pay.
  await page.goto("/search");
  const started = Date.now();
  await openPant(page);
  await expect(page.getByRole("img", { name: /cells A1–B2/ })).toBeVisible();
  expect(Date.now() - started).toBeLessThan(10_000);
});

test("Back keeps the query and its result", async ({ page }) => {
  await page.goto("/search");
  await page.getByRole("main").getByLabel("Search products").fill("e2e hi rise pnt");
  await expect(results(page).getByRole("button", { name: /E2E High-Rise Pant/ })).toBeVisible();
  await page.goto("/products");
  await page.goBack();
  await expect(page).toHaveURL(/\?q=e2e\+hi\+rise\+pnt/);
  await expect(page.getByRole("main").getByLabel("Search products")).toHaveValue("e2e hi rise pnt");
  await expect(results(page).getByRole("button", { name: /E2E High-Rise Pant/ })).toBeVisible();
});

test("the empty toast area does not swallow taps on phones", async ({ page }) => {
  test.skip(sizeOf(test.info()) !== "phone", "The toast strip sits above the bottom tabs on phones.");
  await page.goto("/products");
  const hit = await page.evaluate(() => {
    const el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight - 80);
    return el?.closest("[data-toast-viewport]") ? "toast viewport" : "page";
  });
  expect(hit).toBe("page");
});
