// Frame racks and runs (frame racks spec §8): build a run on the map, plan it
// as one display with hung product only, and find a product on its rail.

import { expect, hydrated, sizeOf, test } from "./fixtures";
import { seedFrameRun, seedLayout, seedLoneRack } from "./map-store";
import { seedCatalog } from "./product-store";

type Page = import("@playwright/test").Page;

test.beforeEach(async () => {
  await seedLayout();
  await seedCatalog();
});

/** + Add a fixture from the one + Add in the top bar (A3). */
async function add(page: Page, label: string) {
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Add to the map" });
  await panel.getByRole("button", { name: label, exact: true }).click();
  await expect(panel).toBeHidden();
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

test("Add rack behind builds a back-to-back run that saves (run joins spec §1)", async ({ page }) => {
  await page.goto("/layout/edit");
  await hydrated(page);
  await add(page, "Frame rack");
  if (sizeOf(test.info()) === "phone") await page.getByRole("region", { name: "Selected" }).getByRole("button", { name: "Expand" }).click();
  await page.getByRole("button", { name: "Add rack behind" }).filter({ visible: true }).click();
  await expect(page.getByText("Run of 2 racks").filter({ visible: true })).toBeVisible();
  await expect(page.getByText("Saved", { exact: true }).filter({ visible: true }).first()).toBeVisible();
  await page.reload();
  await hydrated(page);
  await expect(page.locator('[data-fixture-name^="Frame rack"]')).toHaveCount(2);
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

const rackBox = async (page: Page, name: string) => (await page.locator(`[data-fixture-name="${name}"]`).boundingBox())!;

test("dragging a rack near a run's end shows the join, and only Link links it", async ({ page }) => {
  test.skip(sizeOf(test.info()) !== "desktop", "The mouse drag is the desktop form; touch shares the same gesture code.");
  await seedFrameRun();
  await seedLoneRack("Frame B", 420, 260);
  await page.goto("/layout/edit");
  await hydrated(page);

  const box = await rackBox(page, "Frame B");
  const inch = box.width / 48;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 16 * inch, y, { steps: 10 });
  await expect(page.locator("[data-join-outline]")).toHaveCount(1);
  await page.mouse.up();

  await expect(page.locator("[data-run-outline]")).toHaveCount(0);
  await page.getByRole("button", { name: "Link", exact: true }).click();
  await expect(page.locator("[data-join-outline]")).toHaveCount(0);

  // Selecting any rack outlines the whole run, now three racks.
  const a1 = await rackBox(page, "Frame A1");
  await page.mouse.click(a1.x + a1.width / 2, a1.y + a1.height / 2);
  await expect(page.locator("[data-run-outline]")).toHaveCount(3);
  await expect(page.getByText("Run of 3 racks").filter({ visible: true })).toBeVisible();
  await expect(page.getByText("Saved", { exact: true }).filter({ visible: true }).first()).toBeVisible();
});

test("Link merges two runs, and the right-hand run's planogram moves to the new anchor", async ({ page }) => {
  test.skip(sizeOf(test.info()) !== "desktop", "The mouse drag is the desktop form; the merge is the same at every size.");
  const left = await seedFrameRun();
  const right = await seedFrameRun(["Frame B1", "Frame B2"], 420);

  // The right-hand run has the planogram, holding one product.
  await page.goto(`/planograms/${right.anchorId}`);
  await hydrated(page);
  await page.getByRole("button", { name: "Start draft" }).click();
  await page.getByRole("button", { name: "Add product" }).click();
  await page.getByLabel("Find a product").fill("E2E High");
  await page.getByRole("button", { name: /E2E High-Rise Pant/ }).click();
  await expect(page.locator("[data-draft-status]")).toHaveText("Saved");

  await page.goto("/layout/edit");
  await hydrated(page);
  const box = await rackBox(page, "Frame B1");
  const inch = box.width / 48;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 16 * inch, y, { steps: 10 });
  await page.mouse.up();
  await page.getByRole("button", { name: "Link", exact: true }).click();
  await expect(page.getByText("Run of 4 racks").filter({ visible: true })).toBeVisible();
  await expect(page.getByText("Saved", { exact: true }).filter({ visible: true }).first()).toBeVisible();

  // One run, listed once by its anchor, with the draft and its product intact on all four rails.
  await page.goto("/planograms");
  await expect(page.getByRole("link", { name: /Frame B1/ })).toHaveCount(0);
  await page.goto(`/planograms/${left.anchorId}`);
  await expect(page.getByRole("heading", { level: 1, name: "Frame A1" })).toBeVisible();
  await expect(page.locator("[data-block]")).toHaveCount(4);
  await expect(page.getByRole("button", { name: /^E2E High-Rise Pant, / }).filter({ visible: true })).toBeVisible();
});

test("a long-press starts Select more, and two racks link from a phone", async ({ page }) => {
  test.skip(sizeOf(test.info()) !== "phone", "Long-press is the touch form; shift-click is the desktop one.");
  await seedLoneRack("Frame B", 200, 200);
  await seedLoneRack("Frame C", 200, 280);
  await page.goto("/layout/edit");
  await hydrated(page);

  const first = await rackBox(page, "Frame B");
  const second = await rackBox(page, "Frame C");
  const touch = await page.context().newCDPSession(page);
  const point = { x: first.x + first.width / 2, y: first.y + first.height / 2 };
  await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
  await expect(page.getByText("Select more · 1 selected")).toBeVisible();
  await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

  await page.touchscreen.tap(second.x + second.width / 2, second.y + second.height / 2);
  await expect(page.getByText("Select more · 2 selected")).toBeVisible();
  await page.getByRole("region", { name: "Selected" }).getByRole("button", { name: "Expand" }).click();
  await page.getByRole("button", { name: "Link into run" }).filter({ visible: true }).click();
  await expect(page.getByText(/^Select more/)).toHaveCount(0);
  await expect(page.locator("[data-run-outline]")).toHaveCount(2);
});

test("opening a rack's own id lands on its run's planogram", async ({ page }) => {
  const { anchorId, secondId } = await seedFrameRun();
  await page.goto(`/planograms/${secondId}`);
  await expect(page).toHaveURL(new RegExp(`/planograms/${anchorId}`));
  await expect(page.getByRole("heading", { level: 1, name: "Frame A1" })).toBeVisible();
});
