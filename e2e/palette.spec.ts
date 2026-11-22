// The command palette's flows (0.7.0.8 spec section 12), as the worker's own Store Manager in its own
// store: how it opens at each size, what it finds, where a pick goes, and what it refuses to cover.
// The per-role actions are in palette-roles.spec.ts.

import { expect, hydrated, sizeOf, storeTrigger, switchStore, test } from "./fixtures";
import { seedLayout } from "./map-store";
import { optionLabels, hasGroup, openPalette, paletteDialog, paletteField, searchTrigger } from "./palette-page";
import { seedCatalog } from "./product-store";
import { HOME_STORE, SECOND_STORE } from "./test-account";

test.beforeEach(async () => {
  await seedLayout();
  await seedCatalog();
});

const desktop = () => sizeOf(test.info()) === "desktop";
const main = (page: import("@playwright/test").Page) => page.locator("main#content");

test("the Search trigger opens it, and Escape returns focus to the trigger", async ({ page }) => {
  await page.goto("/products");
  await hydrated(page);
  await expect(searchTrigger(page)).toHaveCount(1);
  await searchTrigger(page).click();
  await expect(paletteField(page)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(paletteDialog(page)).toHaveCount(0);
  await expect(searchTrigger(page)).toBeFocused();
});

test("Ctrl+K toggles it and Escape lands on the page, and / opens it outside a field", async ({ page }) => {
  test.skip(!desktop(), "A keyboard is the desktop's.");
  await page.goto("/account");
  await hydrated(page);
  await page.keyboard.press("Control+K");
  await expect(paletteField(page)).toBeFocused();
  await page.keyboard.press("Control+K");
  await expect(paletteDialog(page)).toHaveCount(0);
  // Pressed with nothing focused, there is no opener to go back to: #content is the place.
  await expect(main(page)).toBeFocused();
  await page.keyboard.press("/");
  await expect(paletteField(page)).toBeFocused();
  await expect(paletteField(page)).toHaveValue("");
  await page.keyboard.press("Escape");
  await expect(main(page)).toBeFocused();
});

test("with no query it lists Go to and Actions", async ({ page }) => {
  await page.goto("/account");
  await openPalette(page);
  expect(await optionLabels(page, "Go to")).toEqual(["Home", "Products", "Layout", "Planograms", "Store", "Account", "Products not placed", "Sold out products"]);
  expect(await optionLabels(page, "Actions")).toEqual(expect.arrayContaining(["Add product", "Edit the store map", "Roles and permissions", "Create a store"]));
});

test("a fixture's name and Enter open its planogram, which Recent then lists", async ({ page }) => {
  await page.goto("/account");
  await openPalette(page);
  await paletteField(page).fill("Table 1");
  await expect(hasGroup(page, "Planograms").getByRole("option", { name: /Table 1/ })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/planograms\/[0-9a-f-]{36}/);
  await expect(page.getByRole("heading", { level: 1, name: "Table 1" })).toBeVisible();
  await expect(paletteDialog(page)).toHaveCount(0);
  await expect(main(page)).toBeFocused();
  await hydrated(page);
  await openPalette(page);
  expect(await optionLabels(page, "Recent")).toEqual(["Table 1"]);
});

test("a zone's name and Enter open the map on that zone, with no ?zone left", async ({ page }) => {
  await page.goto("/account");
  await openPalette(page);
  await paletteField(page).fill("Front tables");
  await expect(hasGroup(page, "Zones").getByRole("option", { name: /Front tables/ })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Whole store" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Front tables" })).toBeVisible();
  await expect(page).toHaveURL(/\/layout$/);
});

test("a style number shows where the product is, and Enter opens it on Products", async ({ page }) => {
  await page.goto("/account");
  await openPalette(page);
  await paletteField(page).fill("E2E-HRP-01");
  const option = hasGroup(page, "Products").getByRole("option", { name: /E2E High-Rise Pant/ });
  await expect(option).toContainText("Table 1 · Left · Middle");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/products\?q=E2E-HRP-01/);
  // The location sheet (phone) or panel (wider) is open already.
  await expect(page.getByText("0–2 ft from left · 0–2 ft from back", { exact: true })).toBeVisible();
});

test("All products matching goes to the search, and nonsense says No matches", async ({ page }) => {
  await page.goto("/account");
  await openPalette(page);
  await paletteField(page).fill("pocket");
  await paletteDialog(page).getByRole("option", { name: /^All .*products matching "pocket"/ }).click();
  await expect(page).toHaveURL(/\/products\?q=pocket/);
  // The new page is in place (the palette closes when the path changes, so wait before reopening it).
  await expect(page.getByRole("main").getByLabel("Search products")).toHaveValue("pocket");
  await hydrated(page);
  await openPalette(page);
  await paletteField(page).fill("zzqxjv");
  await expect(paletteDialog(page).getByText(/No matches for/)).toBeVisible();
});

test("the theme command flips the theme in place, and focus goes back to the trigger", async ({ page }) => {
  await page.goto("/account");
  await openPalette(page);
  await paletteField(page).fill("dark theme");
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page).toHaveURL(/\/account$/);
  await expect(paletteDialog(page)).toHaveCount(0);
});

test("a Switch to command changes the store in the header", async ({ page }) => {
  await page.goto("/account");
  await openPalette(page);
  await paletteField(page).fill("second");
  await page.keyboard.press("Enter");
  await expect(storeTrigger(page)).toHaveAttribute("data-store-trigger", SECOND_STORE);
  await switchStore(page, HOME_STORE);
});

test("Ctrl+K does not open over an open delete dialog", async ({ page }) => {
  await page.goto("/products/categories");
  await hydrated(page);
  await page.getByRole("button", { name: "Delete E2E Pants", exact: true }).click();
  const confirm = page.getByRole("dialog", { name: /Delete E2E Pants/ });
  await expect(confirm).toBeVisible();
  await page.keyboard.press("Control+K");
  await page.keyboard.press("/");
  await expect(paletteDialog(page)).toHaveCount(0);
  await expect(confirm).toBeVisible();
});
