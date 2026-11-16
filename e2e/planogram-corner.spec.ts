// The planogram's corner bar (0.7.0.5 task 4, spec §2.1): every control in one
// row at the top right of the status row, even at 360 px wide; Publish says its
// word from tablet width; + starts a draft on the published planogram. Tap empty
// space adds a product at that spot (0.7.0.5 task 7); trash then Undo brings it back.

import { expect, hydrated, sizeOf, test } from "./fixtures";
import { seedLayout } from "./map-store";
import { seedCatalog } from "./product-store";

type Page = import("@playwright/test").Page;

test.beforeEach(async () => {
  await seedLayout();
  await seedCatalog();
});

async function openTable(page: Page) {
  await page.goto("/planograms");
  await page.getByRole("link", { name: /Table 1/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Table 1" })).toBeVisible();
  await hydrated(page);
}

async function startDraft(page: Page) {
  await page.getByRole("button", { name: "Start planogram" }).click();
  await expect(page.getByRole("button", { name: "Add product" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^E2E High-Rise Pant, / })).toBeVisible();
}

const box = async (page: Page, name: string) => {
  const found = await page.getByRole("button", { name }).boundingBox();
  if (!found) throw new Error(`no ${name}`);
  return found;
};

test("a manager's corner bar fits one row at 360 px wide with every control, in three spaced groups", async ({ page }, info) => {
  test.skip(sizeOf(info) !== "phone", "The narrowest case: a phone.");
  await page.setViewportSize({ width: 360, height: 740 });
  await openTable(page);
  await startDraft(page);

  const [undo, redo, add, publish, more] = await Promise.all(["Undo", "Redo", "Add product", "Publish…", "More draft actions"].map((name) => box(page, name)));
  const indicator = (await page.locator("[data-draft-status]").boundingBox())!;
  const all = [indicator, undo, redo, add, publish, more];
  // One row: every control starts at the same height (the indicator is shorter, so it's centred on it).
  for (const b of [undo, redo, add, publish, more]) {
    expect(Math.abs(b.y - undo.y)).toBeLessThanOrEqual(1);
    expect(b.width).toBeGreaterThanOrEqual(44);
    expect(b.height).toBeGreaterThanOrEqual(44);
  }
  expect(Math.abs(indicator.y + indicator.height / 2 - (undo.y + undo.height / 2))).toBeLessThanOrEqual(1);
  // Inside the screen, in order, nothing over anything, no sideways scroll.
  for (let i = 0; i < all.length; i++) {
    expect(all[i].x).toBeGreaterThanOrEqual(0);
    expect(all[i].x + all[i].width).toBeLessThanOrEqual(360);
    if (i > 0) expect(all[i].x).toBeGreaterThanOrEqual(all[i - 1].x + all[i - 1].width);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  // At the top right of the status row, and only the icon on a phone.
  expect(more.x + more.width).toBeGreaterThan(360 - 32);
  expect(await page.getByRole("button", { name: "Publish…" }).innerText()).toBe("");
  // The gap between groups is at least twice the gap inside one.
  const inside = redo.x - (undo.x + undo.width);
  expect(add.x - (redo.x + redo.width)).toBeGreaterThanOrEqual(2 * inside);
  expect(publish.x - (add.x + add.width)).toBeGreaterThanOrEqual(2 * inside);
});

test("from tablet width Publish says its word, and the whole bar is still one row", async ({ page }, info) => {
  test.skip(sizeOf(info) === "phone", "A phone shows the icon alone.");
  await openTable(page);
  await startDraft(page);
  await expect(page.getByRole("button", { name: "Publish…" })).toHaveText("Publish");
  const undo = await box(page, "Undo");
  const more = await box(page, "More draft actions");
  expect(Math.abs(more.y - undo.y)).toBeLessThanOrEqual(1);
});

test("+ on the published planogram starts the draft and adds the product; Undo takes it back out", async ({ page }) => {
  await openTable(page);
  await startDraft(page);
  await page.getByRole("button", { name: "Publish…" }).click();
  await page.getByRole("button", { name: /^Publish to / }).click();
  await expect(page.getByText("Version 1 published", { exact: true })).toBeVisible();
  // The published version is showing: + is there, with no Start draft and nothing to undo yet.
  await expect(page.getByRole("button", { name: "Undo" })).toHaveCount(0);

  await page.getByRole("button", { name: "Add product" }).click();
  await page.getByLabel("Find a product").fill("E2E Pocket");
  await page.getByRole("button", { name: /E2E Pocket Tee/ }).click();
  await expect(page.locator("[data-draft-status]")).toHaveText("Saved");
  await expect(page.getByRole("group", { name: "Show" })).toBeVisible();
  const tee = page.getByRole("button", { name: /^E2E Pocket Tee, / }).filter({ visible: true });
  await expect(tee).toBeVisible();

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(tee).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^E2E High-Rise Pant, / }).filter({ visible: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Redo" })).toBeEnabled();
});

/**
 * A point in a cell with a clear 4 column x 2 row span (a product here is that size) to its right and below, inside the face:
 * empty space a tapped add can land on. Table 1 is 12 columns of half a foot and 3 rows of two units.
 */
async function emptyPoint(page: Page) {
  return page.evaluate(() => {
    const block = document.querySelector<HTMLElement>("[data-block]")!.getBoundingClientRect();
    const unit = block.width / 12;
    const tiles = [...document.querySelectorAll("[data-placement]")].map((t) => t.getBoundingClientRect());
    const free = (x: number, y: number, w: number, h: number) => !tiles.some((t) => x < t.right && x + w > t.left && y < t.bottom && y + h > t.top);
    for (let col = 0; col <= 8; col++) {
      for (let row = 0; row <= 1; row++) {
        const x = block.left + col * unit;
        const y = block.top + row * 2 * unit;
        if (free(x, y, 4 * unit, 4 * unit)) return { x: x + unit / 2, y: y + unit, unit };
      }
    }
    return null;
  });
}

async function tapAt(page: Page, info: import("@playwright/test").TestInfo, at: { x: number; y: number }) {
  if (sizeOf(info) === "desktop") await page.mouse.click(at.x, at.y);
  else await page.touchscreen.tap(at.x, at.y);
}

async function addTee(page: Page) {
  await expect(page.getByRole("dialog", { name: "Add product" })).toBeVisible();
  await page.getByLabel("Find a product").fill("E2E Pocket");
  await page.getByRole("button", { name: /E2E Pocket Tee/ }).click();
}

test("tapping empty space adds the product at that spot; trash then Undo brings it back", async ({ page }, info) => {
  await openTable(page);
  await startDraft(page);
  const spot = await emptyPoint(page);
  if (!spot) throw new Error("no empty space on Table 1");
  await tapAt(page, info, spot);
  await addTee(page);
  const tee = page.getByRole("button", { name: /^E2E Pocket Tee, / }).filter({ visible: true });
  await expect(tee).toBeVisible();
  await expect(page.locator("[data-draft-status]")).toHaveText("Saved");
  // Its top-left cell is the one tapped: the tile starts at or just before the point and runs right and down from it.
  const tile = (await tee.boundingBox())!;
  expect(tile.x).toBeLessThanOrEqual(spot.x);
  expect(tile.x).toBeGreaterThan(spot.x - spot.unit - 1);
  expect(tile.y).toBeLessThanOrEqual(spot.y);
  expect(tile.y).toBeGreaterThan(spot.y - 2 * spot.unit - 1);
  await expect(page.locator("[data-draft-note]")).toHaveCount(0);

  // It was selected on landing: trash takes it off, Undo puts it back.
  await page.getByRole("button", { name: "Remove E2E Pocket Tee" }).click();
  await expect(tee).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(tee).toBeVisible();
  const back = (await tee.boundingBox())!;
  expect(Math.abs(back.x - tile.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(back.y - tile.y)).toBeLessThanOrEqual(1);
});

test("a tap with a tile selected only deselects, and Enter on the grid opens Add at the first open spot", async ({ page }, info) => {
  await openTable(page);
  await startDraft(page);
  const pant = page.getByRole("button", { name: /^E2E High-Rise Pant, / }).filter({ visible: true });
  await pant.click();
  await expect(pant).toHaveAttribute("aria-pressed", "true");
  const spot = await emptyPoint(page);
  if (!spot) throw new Error("no empty space on Table 1");
  await tapAt(page, info, spot);
  await expect(pant).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("dialog", { name: "Add product" })).toHaveCount(0);

  // Nothing is selected now: the grid is a tab stop, and Enter on it opens Add, with no cell.
  await page.locator("body").click({ position: { x: 1, y: 1 } });
  for (let i = 0; i < 60 && !(await page.evaluate(() => document.activeElement?.hasAttribute("data-planogram-grid"))); i++) await page.keyboard.press("Tab");
  await expect(page.locator("[data-planogram-grid]")).toBeFocused();
  await page.keyboard.press("Enter");
  await addTee(page);
  await expect(page.getByRole("button", { name: /^E2E Pocket Tee, / }).filter({ visible: true })).toBeVisible();
});
