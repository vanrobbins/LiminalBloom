// The Quick Adjust commands in the palette (0.7.0.9 task 7c; DECISIONS 11-17 Q7): "Quick Adjust <fixture>" for a
// planogram with a published version and "Adjust <product>" for a sold-out product on a floor, as the worker's own
// Store Manager. Which roles get them is unit-tested (a role that may draft sees them, one that may not never has them
// sent). The seed is Home's (Wall B and Table 1 published, the placed E2E pant sold out), put back afterwards.

import { expect, test } from "./fixtures";
import { sql } from "./map-store";
import { optionLabels, openPalette, paletteField } from "./palette-page";
import { endAdjustWork, homeStoreId, seedHomeWork, startAdjustWork, clearHomeWork, type HomeSeed } from "./home-store";

let seed: HomeSeed;
test.beforeEach(async () => {
  seed = await seedHomeWork();
  const db = sql();
  const store = await homeStoreId();
  // Table 1 holds the pant, so it has a published version (a floor place comes from a publish).
  const [plan] = await db`select id from planograms where store_id = ${store} and fixture_id = ${seed.ids.table}`;
  await db`update planograms set published_version = 1, has_draft = false where id = ${plan.id}`;
  await db`insert into planogram_versions (store_id, planogram_id, number, published_by_name, placements) values (${store}, ${plan.id}, 1, ${seed.publisher}, '[]'::jsonb)`;
  await startAdjustWork(seed.ids.published);
});
test.afterEach(() => endAdjustWork());
test.afterAll(() => clearHomeWork());

test("Quick Adjust <fixture> is found by name and opens that fixture's adjust page", async ({ page }) => {
  await page.goto("/home");
  await openPalette(page);
  await paletteField(page).fill("quick adjust wall b");
  await expect.poll(() => optionLabels(page, "Actions")).toContain("Quick Adjust Wall B");
  await expect(page.getByRole("option", { name: "Quick Adjust Wall A" })).toHaveCount(0); // Wall A has no published version
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/planograms/${seed.ids.published}/adjust$`));
  await expect(page.getByRole("heading", { level: 1, name: "Wall B" })).toBeVisible();
});

test("Adjust <product> is offered for a sold-out product on a floor and opens its fixture with ?product=", async ({ page }) => {
  await page.goto("/home");
  await openPalette(page);
  await paletteField(page).fill("E2E-HRP-01");
  await expect.poll(() => optionLabels(page, "Actions")).toContain("Adjust E2E High-Rise Pant");
  await page.getByRole("option", { name: "Adjust E2E High-Rise Pant" }).click();
  await expect(page).toHaveURL(new RegExp(`/planograms/${seed.ids.table}/adjust\\?product=[0-9a-f-]{36}$`));
  await expect(page.getByRole("heading", { level: 1, name: "Table 1" })).toBeVisible();
});

test("no Adjust command for a product that is in stock", async ({ page }) => {
  await endAdjustWork();
  await page.goto("/home");
  await openPalette(page);
  await paletteField(page).fill("E2E-HRP-01");
  await expect(page.getByRole("option", { name: /E2E-HRP-01|High-Rise Pant/ }).first()).toBeVisible();
  await expect(page.getByRole("option", { name: "Adjust E2E High-Rise Pant" })).toHaveCount(0);
});
