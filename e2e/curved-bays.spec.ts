// Curved wall bays (curved wall bays spec §6): bend a bay from the panel and on
// the map, and it stays curved after a reload.

import { expect, hydrated, sizeOf, test } from "./fixtures";
import { seedLayout, seedWallBay } from "./map-store";

type Page = import("@playwright/test").Page;

test.beforeEach(async () => {
  await seedLayout();
});

/** + Add a wall bay from the one + Add in the top bar (A3), and open its properties. */
async function addWallBay(page: Page) {
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Add to the map" });
  await panel.getByRole("button", { name: "Wall bay", exact: true }).click();
  await expect(panel).toBeHidden();
  if (sizeOf(test.info()) === "phone") await page.getByRole("region", { name: "Selected" }).getByRole("button", { name: "Expand" }).click();
}

const saved = (page: Page) => expect(page.getByText("Saved", { exact: true }).filter({ visible: true }).first()).toBeVisible();

test("curves a wall bay from the panel, flips it, and keeps it after a reload", async ({ page }) => {
  await page.goto("/layout/edit");
  await hydrated(page);
  await addWallBay(page);

  const inches = page.getByRole("textbox", { name: "Curve, inches" }).filter({ visible: true });
  await inches.fill("10");
  await inches.press("Enter");
  await expect(page.locator("[data-curved]")).toHaveCount(1);
  await expect(page.getByText("Bends toward the front").filter({ visible: true })).toBeVisible();
  await expect(page.getByRole("group", { name: "Width along the curve" }).filter({ visible: true })).toBeVisible();

  await page.getByRole("button", { name: "Flip curve" }).filter({ visible: true }).click();
  await expect(page.getByText("Bends toward the back").filter({ visible: true })).toBeVisible();
  await saved(page);

  await page.reload();
  await expect(page.locator("[data-curved]")).toHaveCount(1);
});

test("bends a wall bay by dragging its curve handle", async ({ page }) => {
  test.skip(sizeOf(test.info()) !== "desktop", "The mouse drag is the desktop form; touch shares the same gesture code.");
  await page.goto("/layout/edit");
  await hydrated(page);
  await addWallBay(page);

  const box = await page.locator('[data-handle="curve"]').boundingBox();
  if (!box) throw new Error("no curve handle");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 30, { steps: 10 });
  await page.mouse.up();

  await expect(page.locator("[data-curved]")).toHaveCount(1);
  await expect(page.getByText("Bends toward the front").filter({ visible: true })).toBeVisible();
  await saved(page);
});

test("wall bays link into a run that keeps a curved bay, and save (run joins spec §2)", async ({ page }) => {
  await page.goto("/layout/edit");
  await hydrated(page);
  await addWallBay(page);
  const inches = page.getByRole("textbox", { name: "Curve, inches" }).filter({ visible: true });
  await inches.fill("6");
  await inches.press("Enter");
  await page.getByRole("button", { name: "Add bay to the right" }).filter({ visible: true }).click();
  await expect(page.getByText("Run of 2 bays").filter({ visible: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add rack behind" })).toHaveCount(0);
  await saved(page);

  await page.reload();
  await hydrated(page);
  await expect(page.locator('[data-fixture-name^="Wall bay"]')).toHaveCount(2);
  await expect(page.locator("[data-curved]")).toHaveCount(1);
});

test("Fit to corner bends a bay between two bays at a corner, and links nothing (run joins spec §3.2)", async ({ page }) => {
  test.skip(sizeOf(test.info()) !== "desktop", "Picking the bay by its place on the map is the desktop form; the panel is the same at every size.");
  // An inside corner at (300, 100): Bay A along the top, Bay B down the side, Bay F across it.
  await seedWallBay("Bay A", 200, 112);
  await seedWallBay("Bay B", 288, 224, 90);
  await seedWallBay("Bay F", 270, 150, 0, 96);
  await page.goto("/layout/edit");
  await hydrated(page);
  const box = await page.locator('[data-fixture-name="Bay F"]').boundingBox();
  if (!box) throw new Error("Bay F is not on the map");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.getByRole("button", { name: "Fit to corner" }).filter({ visible: true }).click();
  await expect(page.locator('[data-fixture-name="Bay F"] [data-curved]')).toHaveCount(1);
  await saved(page);

  await page.reload();
  await hydrated(page);
  await expect(page.locator('[data-fixture-name="Bay F"] [data-curved]')).toHaveCount(1);
  await expect(page.locator("[data-run-outline]")).toHaveCount(0);
  await expect(page.getByText(/Run of \d/)).toHaveCount(0);
});
