// Product cards (Part 2 spec §6) at phone, tablet and desktop: the
// location-first cards on Products open the location sheet. (The library's
// photo-first cards left the page when Products and Search merged, Week 6.5.)

import { expect, hydrated, sizeOf, test } from "./fixtures";
import { seedLayout } from "./map-store";
import { seedCatalog } from "./product-store";

test.beforeEach(async () => {
  await seedLayout();
  await seedCatalog();
});

test("Products shows where a product goes first, and the card opens the location sheet", async ({ page }) => {
  await page.goto("/products?q=E2E-HRP-01");
  await hydrated(page);
  const card = page.getByRole("main").getByRole("button", { name: /^E2E High-Rise Pant/ });
  await expect(card).toContainText("Table 1 · Left · Middle");
  await card.click();
  await expect(page.getByRole("link", { name: "Open planogram" }).filter({ visible: true })).toBeVisible();
});

test("with a card's panel open, the results keep room for the product name", async ({ page }, info) => {
  test.skip(sizeOf(info) === "phone", "On a phone the sheet covers the list.");
  await page.goto("/products?q=E2E-HRP-01");
  await hydrated(page);
  const card = page.getByRole("main").getByRole("button", { name: /^E2E High-Rise Pant/ });
  await card.click();
  await expect(page.getByRole("link", { name: "Open planogram" }).filter({ visible: true })).toBeVisible();
  const name = await card.getByText("E2E High-Rise Pant", { exact: true }).boundingBox();
  expect(name?.width ?? 0).toBeGreaterThanOrEqual(100);
});
