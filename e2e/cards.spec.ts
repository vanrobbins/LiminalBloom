// Product cards (Part 2 spec §6) at phone, tablet and desktop: the library's
// photo-first cards open the product; Search's location-first cards open the
// location sheet; columns grow with the screen.

import { expect, hydrated, sizeOf, test } from "./fixtures";
import { seedLayout } from "./map-store";
import { seedCardProducts, seedCatalog } from "./product-store";

test.beforeEach(async () => {
  await seedLayout();
  await seedCatalog();
});

// Desktop is 1280 px, the `xl` breakpoint: five columns of ~200 px beside the sidebar.
const COLUMNS = { phone: 2, tablet: 3, desktop: 5 } as const;

test("the library shows photo-first cards that open the product, in more columns on wider screens", async ({ page }, info) => {
  // Enough products to fill the widest row, whatever else the store holds.
  await seedCardProducts();
  await page.goto("/products");
  await hydrated(page);
  const cards = page.locator("[data-product-card]");
  await expect(cards.first()).toBeVisible();
  const tops = await cards.evaluateAll((all) => all.slice(0, 6).map((c) => Math.round(c.getBoundingClientRect().top)));
  expect(tops.length).toBeGreaterThanOrEqual(COLUMNS[sizeOf(info)]);
  expect(tops.filter((t) => t === tops[0]).length).toBe(COLUMNS[sizeOf(info)]);
  await cards.filter({ hasText: "E2E High-Rise Pant" }).click();
  await expect(page).toHaveURL(/\/products\/[0-9a-f-]{36}$/);
});

test("Search shows where a product goes first, and the card opens the location sheet", async ({ page }) => {
  await page.goto("/search?q=E2E-HRP-01");
  await hydrated(page);
  const card = page.getByRole("main").getByRole("button", { name: /E2E High-Rise Pant/ });
  await expect(card).toContainText("Table 1 · Left · Middle");
  await card.click();
  await expect(page.getByRole("link", { name: "Open planogram" }).filter({ visible: true })).toBeVisible();
});

test("with a card's panel open, the results keep room for the product name", async ({ page }, info) => {
  test.skip(sizeOf(info) === "phone", "On a phone the sheet covers the list.");
  await page.goto("/search?q=E2E-HRP-01");
  await hydrated(page);
  const card = page.getByRole("main").getByRole("button", { name: /E2E High-Rise Pant/ });
  await card.click();
  await expect(page.getByRole("link", { name: "Open planogram" }).filter({ visible: true })).toBeVisible();
  const name = await card.getByText("E2E High-Rise Pant", { exact: true }).boundingBox();
  expect(name?.width ?? 0).toBeGreaterThanOrEqual(100);
});
