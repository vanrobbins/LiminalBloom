// Frame racks and runs (frame racks spec §8): build a run on the map, plan it
// as one display with hung product only, and find a product on its rail.

import { expect, hydrated, sizeOf, test } from "./fixtures";
import { seedFrameRun, seedLayout } from "./map-store";
import { seedCatalog } from "./product-store";

type Page = import("@playwright/test").Page;

test.beforeEach(async () => {
  await seedLayout();
  await seedCatalog();
});

/** + Add a fixture in whichever form the screen size has. */
async function add(page: Page, label: string) {
  const size = sizeOf(test.info());
  if (size === "desktop") {
    await page.getByRole("region", { name: "Add to the map" }).getByRole("button", { name: label, exact: true }).click();
  } else if (size === "tablet") {
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await page.getByRole("menuitem", { name: label, exact: true }).click();
  } else {
    await page.getByRole("navigation", { name: "Editor" }).getByRole("button", { name: "Add", exact: true }).click();
    const sheet = page.getByRole("dialog", { name: "Add to the map" });
    await sheet.getByRole("button", { name: label, exact: true }).click();
    await expect(sheet).toBeHidden();
  }
}

test("adds a frame rack and builds a run from it", async ({ page }) => {
  await page.goto("/layout/edit");
  await hydrated(page);
  await add(page, "Frame rack");
  if (sizeOf(test.info()) === "phone") await page.getByRole("region", { name: "Selected" }).getByRole("button", { name: "Expand" }).click();
  await expect(page.getByText("1 rail").filter({ visible: true })).toBeVisible();
  await page.getByRole("button", { name: "Add rack to the right" }).filter({ visible: true }).click();
  await expect(page.getByText("Run of 2 racks").filter({ visible: true })).toBeVisible();
  await expect(page.locator('[data-fixture-name^="Frame rack"]')).toHaveCount(2);
  await expect(page.getByText("Saved", { exact: true }).filter({ visible: true }).first()).toBeVisible();
});

test("a run is one planogram: both rails on one grid, hung only", async ({ page }) => {
  await seedFrameRun();
  await page.goto("/planograms");
  // Listed once, by its anchor.
  await expect(page.getByRole("link", { name: /Frame A2/ })).toHaveCount(0);
  await page.getByRole("link", { name: /Frame A1/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Frame A1" })).toBeVisible();
  await hydrated(page);
  await page.getByRole("button", { name: "Start draft" }).click();
  await expect(page.locator("[data-block]")).toHaveCount(2);

  await page.getByRole("button", { name: "Add product" }).click();
  await page.getByLabel("Find a product").fill("E2E High");
  await page.getByRole("button", { name: /E2E High-Rise Pant/ }).click();
  await expect(page.locator("[data-draft-status]")).toHaveText("Saved");
  const tile = page.getByRole("button", { name: /^E2E High-Rise Pant, .*Hung/ }).filter({ visible: true });
  await expect(tile).toBeVisible();
  await expect(tile.locator("svg[data-view]")).toHaveAttribute("data-view", "hung");

  // Add leaves the new tile selected, with its toolbar open.
  await page.getByRole("button", { name: "Edit numbers" }).click();
  await expect(page.getByRole("radio", { name: "Folded" })).toBeDisabled();
  await expect(page.getByText("Frame racks hold hung product only, on their one rail.")).toBeVisible();
});

test("opening a rack's own id lands on its run's planogram", async ({ page }) => {
  const { anchorId, secondId } = await seedFrameRun();
  await page.goto(`/planograms/${secondId}`);
  await expect(page).toHaveURL(new RegExp(`/planograms/${anchorId}`));
  await expect(page.getByRole("heading", { level: 1, name: "Frame A1" })).toBeVisible();
});
