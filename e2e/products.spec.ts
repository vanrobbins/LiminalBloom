// Products (§3.2, Week 6.5 spec §2): one screen to find a product and manage
// the catalog. Search merged into it; /search redirects here.

import { expect, hydrated, sizeOf, test } from "./fixtures";
import { seedLayout } from "./map-store";
import { seedCardProducts, seedCatalog } from "./product-store";

test.beforeEach(async () => {
  await seedLayout();
  await seedCatalog();
});

const results = (page: import("@playwright/test").Page) => page.getByRole("main").getByRole("list").first();
// The card itself, not its ⋯ menu button (1024 px and up), whose name also holds the product's.
const card = (page: import("@playwright/test").Page, name: string) => results(page).getByRole("button", { name: new RegExp(`^${name}`) });
const searchBox = (page: import("@playwright/test").Page) => page.getByRole("main").getByLabel("Search products");

async function openPant(page: import("@playwright/test").Page) {
  await page.goto("/products");
  await searchBox(page).fill("e2e hi rise pnt");
  const row = card(page, "E2E High-Rise Pant");
  await expect(row).toContainText("Table 1 · Left · Middle");
  await expect(row).toContainText("Folded · 0–2 ft from left · 0–2 ft from back");
  await row.click();
}

test("finds a product through a typo and shows exactly where it goes", async ({ page }) => {
  await openPant(page);
  // The card in the list says it too; the sheet or panel is the later one.
  await expect(page.getByText("Table 1 · Left · Middle", { exact: true }).last()).toBeVisible();
  await expect(page.getByText("0–2 ft from left · 0–2 ft from back", { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "Table 1 · Left · Middle, 0–2 ft from left · 0–2 ft from back" })).toBeVisible();
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
    await p.goto("/products?q=E2E-HRP-01");
    await card(p, "E2E High-Rise Pant").click();
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
  await page.goto("/products?q=e2e");
  await expect(results(page).locator("[data-result-id]")).toHaveCount(2);
  await page.goto("/products?q=e2e&place=unplaced");
  await expect(results(page).locator("[data-result-id]")).toHaveCount(1);
  await expect(results(page)).toContainText("E2E Pocket Tee");
});

test("an unmatched search says so", async ({ page }) => {
  await page.goto("/products?q=zzqqxx");
  await expect(page.getByText("No products match “zzqqxx”.")).toBeVisible();
});

test("Products is the first bottom tab on phones, and opens ready to type", async ({ page }) => {
  test.skip(sizeOf(test.info()) !== "phone", "Tabs are the phone's navigation.");
  await page.goto("/layout");
  const tabs = page.getByRole("navigation", { name: "Main" }).filter({ visible: true }).getByRole("link");
  await expect(tabs).toHaveText(["Products", "Layout", "Planograms", "Account"]);
  await tabs.first().click();
  await expect(page).toHaveURL(/\/products$/);
  await expect(searchBox(page)).toBeFocused();
});

test("an old /search link lands on Products with its query and result", async ({ page }) => {
  await page.goto("/search?q=E2E-HRP-01&status=in_stock");
  await expect(page).toHaveURL(/\/products\?q=E2E-HRP-01&status=in_stock$/);
  await expect(card(page, "E2E High-Rise Pant")).toBeVisible();
});

test("Show more adds the next 30 and moves focus to the first new card", async ({ page }) => {
  await seedCardProducts(31);
  await page.goto("/products");
  await hydrated(page);
  const cards = results(page).locator("[data-result-id]");
  await expect(cards).toHaveCount(30);
  await expect(page.getByText(/^30 of [\d,]+ products$/)).toBeVisible();
  await page.getByRole("button", { name: "Show more" }).click();
  await expect(cards.nth(30)).toBeFocused();
  expect(await cards.count()).toBeGreaterThan(30);
  const ids = await cards.evaluateAll((all) => all.map((c) => c.getAttribute("data-result-id")));
  expect(new Set(ids).size).toBe(ids.length);
});

test("sorting is kept in the URL", async ({ page }) => {
  await page.goto("/products?q=e2e");
  await hydrated(page);
  if (sizeOf(test.info()) === "phone") await page.getByRole("button", { name: /^Filters/ }).click();
  else await page.getByText("Filters", { exact: true }).click();
  // The radio is visually hidden inside its chip; a person taps the chip.
  await page.getByText("Recently updated", { exact: true }).click();
  await expect(page).toHaveURL(/sort=updated/);
});

test("the location sheet's Edit product link opens the product", async ({ page }) => {
  await openPant(page);
  await page.getByRole("link", { name: "Edit product" }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/products\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name: "E2E High-Rise Pant" })).toBeVisible();
});

test("the title row offers Add product and Categories at every size", async ({ page }) => {
  await page.goto("/products");
  await hydrated(page);
  await expect(page.getByRole("link", { name: "Add product" }).filter({ visible: true })).toHaveAttribute("href", "/products/new");
  if (sizeOf(test.info()) === "phone") {
    await page.getByRole("button", { name: "More product actions" }).click();
    await page.getByRole("menuitem", { name: "Categories" }).click();
  } else {
    await page.getByRole("link", { name: "Categories" }).filter({ visible: true }).click();
  }
  await expect(page).toHaveURL(/\/products\/categories$/);
});

test("on desktop a card's ⋯ menu deletes the product and the list drops it", async ({ page }) => {
  test.skip(sizeOf(test.info()) !== "desktop", "The ⋯ menu is there from 1024 px.");
  await seedCardProducts(1);
  await page.goto("/products?q=E2E-CARD-1");
  await hydrated(page);
  await page.getByRole("button", { name: "More for E2E Card 1" }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete product" }).click();
  await expect(page.getByText("Deleted E2E Card 1", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/products\?q=E2E-CARD-1$/);
  await expect(results(page).locator("[data-result-id]").filter({ hasText: "E2E Card 1" })).toHaveCount(0);
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
  await page.goto("/products");
  const started = Date.now();
  await openPant(page);
  await expect(page.getByRole("img", { name: /0–2 ft from left/ })).toBeVisible();
  expect(Date.now() - started).toBeLessThan(10_000);
});

test("Back keeps the query and its result", async ({ page }) => {
  await page.goto("/products");
  await searchBox(page).fill("e2e hi rise pnt");
  await expect(card(page, "E2E High-Rise Pant")).toBeVisible();
  await page.goto("/layout");
  await page.goBack();
  await expect(page).toHaveURL(/\?q=e2e\+hi\+rise\+pnt/);
  await expect(searchBox(page)).toHaveValue("e2e hi rise pnt");
  await expect(card(page, "E2E High-Rise Pant")).toBeVisible();
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
