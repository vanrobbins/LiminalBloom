// The drag-and-drop builder (Part 2 spec §4) at every size: a drag moves half a
// foot at a time, Undo and Redo put it back and forth; a resize; an invalid drop
// snaps back and says why; the first drag on a published planogram starts a
// draft; the arrow keys move and announce. Phones and tablets drag with a real
// touch (CDP), proving a drag on the selected tile neither scrolls the page nor
// swipes the face, while a swipe elsewhere still changes it (Review Focus 1).

import { expect, hydrated, sizeOf, test } from "./fixtures";
import { seedLayout, seedRack } from "./map-store";
import { seedCatalog } from "./product-store";

type Page = import("@playwright/test").Page;
type Locator = import("@playwright/test").Locator;
type Info = import("@playwright/test").TestInfo;

test.beforeEach(async () => {
  await seedLayout();
  await seedCatalog();
});

const tile = (page: Page, product: string) => page.getByRole("button", { name: new RegExp(`^${product}, `) }).filter({ visible: true });
const card = (page: Page, product: string) => page.locator("[data-card]").filter({ hasText: product });
const saved = (page: Page) => expect(page.locator("[data-draft-status]")).toHaveText("Saved");
const selectedBar = (page: Page, product: string) => page.getByRole("toolbar", { name: `${product} selected` });

async function openTable(page: Page) {
  await page.goto("/planograms");
  await page.getByRole("link", { name: /Table 1/ }).click();
  await hydrated(page);
}

async function startDraft(page: Page) {
  await page.getByRole("button", { name: "Start draft" }).click();
  await expect(page.getByRole("button", { name: "Add product" })).toBeVisible();
}

/** Add places the tee at the first open spot and selects it. */
async function addTee(page: Page) {
  await page.getByRole("button", { name: "Add product" }).click();
  await page.getByLabel("Find a product").fill("E2E Pocket");
  await page.getByRole("button", { name: /E2E Pocket Tee/ }).click();
  await saved(page);
  await expect(selectedBar(page, "E2E Pocket Tee")).toBeVisible();
}

/** A real touch stroke through the browser's input pipeline, so scrolling and pointer capture behave as on a phone. */
async function touchDrag(page: Page, x: number, y: number, dx: number, dy: number) {
  const cdp = await page.context().newCDPSession(page);
  const at = (px: number, py: number) => [{ x: Math.round(px), y: Math.round(py) }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: at(x, y) });
  for (let i = 1; i <= 10; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: at(x + (dx * i) / 10, y + (dy * i) / 10) });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

/** Drags from the middle of `target` by (dx, dy) px: a real touch on a phone or tablet, the mouse elsewhere. */
async function dragBy(page: Page, target: Locator, dx: number, dy: number, info: Info) {
  const box = await target.boundingBox();
  if (!box) throw new Error("nothing to drag");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  if (sizeOf(info) !== "desktop") return touchDrag(page, x, y, dx, dy);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 10 });
  await page.mouse.up();
}

/** Pixels per half foot, from the pant (4 half-foot columns wide, drawn 2 px narrower). */
async function halfFoot(page: Page) {
  const box = await tile(page, "E2E High-Rise Pant").boundingBox();
  if (!box) throw new Error("no pant");
  return (box.width + 2) / 4;
}

test("a selected tile drags two feet, then Undo and Redo move it back and forth", async ({ page }, info) => {
  await openTable(page);
  await startDraft(page);
  await tile(page, "E2E High-Rise Pant").click();
  await expect(selectedBar(page, "E2E High-Rise Pant")).toBeVisible();
  const unit = await halfFoot(page);
  const canScroll = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight > 20);
  if (canScroll) await page.evaluate(() => window.scrollTo(0, 20));
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await dragBy(page, tile(page, "E2E High-Rise Pant"), unit * 4, 0, info);
  await saved(page);
  await expect(card(page, "E2E High-Rise Pant")).toContainText("Center · Middle");
  if (canScroll) expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(card(page, "E2E High-Rise Pant")).toContainText("Left · Middle");
  await saved(page);
  await page.keyboard.press("Control+Shift+z");
  await expect(card(page, "E2E High-Rise Pant")).toContainText("Center · Middle");
  await saved(page);
  // The status line may still show the previous "Saved": a reload proves the last step reached the server.
  await expect(async () => {
    await page.reload();
    await expect(card(page, "E2E High-Rise Pant")).toContainText("Center · Middle", { timeout: 2000 });
  }).toPass();
});

test("the right handle widens a tile half a foot at a time", async ({ page }, info) => {
  await openTable(page);
  await startDraft(page);
  await tile(page, "E2E High-Rise Pant").click();
  const unit = await halfFoot(page);
  await dragBy(page, page.locator('[data-handle="right"]'), unit * 2, 0, info);
  await saved(page);
  await page.getByRole("button", { name: "Details" }).click();
  await expect(page.getByText("0–3 ft from left · 0–2 ft from back").filter({ visible: true })).toBeVisible();
});

test("an invalid drop snaps back and says why", async ({ page }, info) => {
  await openTable(page);
  await startDraft(page);
  await addTee(page);
  const unit = await halfFoot(page);
  const before = await tile(page, "E2E Pocket Tee").boundingBox();
  await dragBy(page, tile(page, "E2E Pocket Tee"), -unit * 2, 0, info);
  await expect(page.getByText("Blocked by E2E High-Rise Pant").filter({ visible: true }).first()).toBeVisible();
  await expect(card(page, "E2E Pocket Tee")).toContainText("Center · Middle");
  // The tile itself is back where it started, not left mid-drag.
  await expect(async () => {
    const after = await tile(page, "E2E Pocket Tee").boundingBox();
    expect(after && before && Math.abs(after.x - before.x) < 2 && Math.abs(after.y - before.y) < 2).toBe(true);
  }).toPass();
});

test("the first drag on a published planogram starts a draft", async ({ page }, info) => {
  await openTable(page);
  await startDraft(page);
  await page.getByRole("button", { name: "Publish…" }).click();
  await page.getByRole("button", { name: /^Publish to / }).click();
  await expect(page.getByText("Version 1 published", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start draft" })).toBeVisible();

  await tile(page, "E2E High-Rise Pant").click();
  // A published tile opens its sheet. On a phone it is a modal dialog: wait for it, then close it (the tile stays selected).
  // Tablet and desktop show a side panel that doesn't cover the grid.
  if (sizeOf(info) === "phone") {
    const sheet = page.getByRole("dialog", { name: "E2E High-Rise Pant" });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("button", { name: "Close" }).click();
    await expect(sheet).toBeHidden();
  } else {
    await expect(page.getByRole("complementary", { name: "E2E High-Rise Pant" })).toBeVisible();
  }
  const unit = await halfFoot(page);
  await dragBy(page, tile(page, "E2E High-Rise Pant"), unit * 4, 0, info);
  await expect(page.getByText("Draft started", { exact: true })).toBeVisible();
  await saved(page);
  await expect(page.getByRole("group", { name: "Show" })).toBeVisible();
  await expect(card(page, "E2E High-Rise Pant")).toContainText("Center · Middle");
});

test("by touch, the selected tile drags without scrolling or swiping; a swipe elsewhere changes face", async ({ page }, info) => {
  test.skip(sizeOf(info) === "desktop", "touch only");
  const { rackId } = await seedRack();
  await page.goto(`/planograms/${rackId}`);
  await hydrated(page);
  await startDraft(page);
  await addTee(page);
  const front = page.getByRole("region", { name: /Rack 1, Front/ });
  await expect(front).toBeVisible();
  const before = await tile(page, "E2E Pocket Tee").boundingBox();
  if (!before) throw new Error("no tee");
  // The scroll check means nothing on a page that can't scroll: only compare where it can.
  const canScroll = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight > 20);
  if (canScroll) await page.evaluate(() => window.scrollTo(0, 20));
  const scrollBefore = await page.evaluate(() => window.scrollY);

  // The tee is half the rack wide: dragging it its own width is a swipe-sized stroke; the vertical wobble would scroll the page if the tile didn't own the touch.
  await dragBy(page, tile(page, "E2E Pocket Tee"), before.width + 2, 12, info);
  await saved(page);
  // Moved, then the face unchanged, then the page unscrolled.
  const after = await tile(page, "E2E Pocket Tee").boundingBox();
  expect(after && after.x - before.x).toBeGreaterThan(before.width / 2);
  await expect(front).toBeVisible();
  await expect(page.getByRole("group", { name: "Side" }).getByRole("button", { name: "Front" })).toHaveAttribute("aria-pressed", "true");
  if (canScroll) expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);

  // A swipe on empty grid (the bottom row, right side) changes face. Bring the grid on screen
  // and make sure the start point is in the viewport and not under the phone's selection bar.
  await front.scrollIntoViewIfNeeded();
  const grid = await front.boundingBox();
  if (!grid) throw new Error("no grid");
  const startY = grid.y + grid.height - 16;
  const bar = await selectedBar(page, "E2E Pocket Tee").boundingBox();
  expect(startY).toBeLessThan(Math.min(page.viewportSize()?.height ?? Infinity, bar ? bar.y : Infinity));
  await touchDrag(page, grid.x + grid.width - 24, startY, -160, 0);
  await expect(page.getByRole("region", { name: /Rack 1, Back/ })).toBeVisible();
});

test("on a phone, the selection bar sits above the tabs and clears the grid and the last card", async ({ page }, info) => {
  test.skip(sizeOf(info) !== "phone", "phone only");
  await openTable(page);
  await startDraft(page);
  await tile(page, "E2E High-Rise Pant").click();
  const bar = selectedBar(page, "E2E High-Rise Pant");
  await expect(bar).toBeVisible();
  const tabs = page.getByRole("navigation", { name: "Main" }).filter({ visible: true });
  const barBox = await bar.boundingBox();
  const tabsBox = await tabs.boundingBox();
  if (!barBox || !tabsBox) throw new Error("no bar or tabs");
  expect(barBox.y + barBox.height).toBeLessThanOrEqual(tabsBox.y + 1);
  // The draft bar yields to it.
  await expect(page.getByRole("button", { name: "Add product" })).toBeHidden();

  await page.locator("[data-planogram-grid]").evaluate((el) => el.scrollIntoView({ block: "start" }));
  const grid = await page.locator("[data-planogram-grid]").boundingBox();
  if (!grid) throw new Error("no grid");
  expect(grid.y + grid.height).toBeLessThanOrEqual(barBox.y);

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const last = await page.locator("[data-card]").last().boundingBox();
  const barNow = await bar.boundingBox();
  expect(last && barNow && last.y + last.height <= barNow.y).toBe(true);
});

test("arrow keys move the selected tile and say where it went; Ctrl+Z undoes", async ({ page }, info) => {
  test.skip(sizeOf(info) !== "desktop", "keyboard");
  await openTable(page);
  await startDraft(page);
  await tile(page, "E2E High-Rise Pant").click();
  await page.keyboard.press("ArrowRight");
  await saved(page);
  await expect(page.getByText("Moved to ½–2½ ft, Middle")).toBeAttached();
  await page.keyboard.press("Control+z");
  await expect(page.getByText("Undone: 0–2 ft, Middle")).toBeAttached();
  await expect(card(page, "E2E High-Rise Pant")).toContainText("Left · Middle");
});
