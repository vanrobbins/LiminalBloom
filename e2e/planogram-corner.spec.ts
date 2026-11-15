// The planogram's corner bar (0.7.0.5 task 4, spec §2.1): every control in one
// row at the top right of the status row, even at 360 px wide; Publish says its
// word from tablet width; + starts a draft on the published planogram.

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
