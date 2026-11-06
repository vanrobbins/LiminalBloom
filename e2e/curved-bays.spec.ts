// Curved wall bays (curved wall bays spec §6): bend a bay from the panel and on
// the map, and it stays curved after a reload.

import { expect, hydrated, sizeOf, test } from "./fixtures";
import { seedLayout } from "./map-store";

type Page = import("@playwright/test").Page;

test.beforeEach(async () => {
  await seedLayout();
});

/** + Add a wall bay in whichever form the screen size has, and open its properties. */
async function addWallBay(page: Page) {
  const size = sizeOf(test.info());
  if (size === "desktop") {
    await page.getByRole("region", { name: "Add to the map" }).getByRole("button", { name: "Wall bay", exact: true }).click();
  } else if (size === "tablet") {
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await page.getByRole("menuitem", { name: "Wall bay", exact: true }).click();
  } else {
    await page.getByRole("navigation", { name: "Editor" }).getByRole("button", { name: "Add", exact: true }).click();
    const sheet = page.getByRole("dialog", { name: "Add to the map" });
    await sheet.getByRole("button", { name: "Wall bay", exact: true }).click();
    await expect(sheet).toBeHidden();
    await page.getByRole("region", { name: "Selected" }).getByRole("button", { name: "Expand" }).click();
  }
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
