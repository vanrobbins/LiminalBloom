// The drag-and-drop builder (Part 2 spec §4) at every size: a drag moves half a
// foot at a time, Undo and Redo put it back and forth; a resize; an invalid drop
// snaps back and says why; the first drag on a published planogram starts a
// draft; the arrow keys move and announce. Phones and tablets drag with a real
// touch (CDP), proving a drag on the selected tile neither scrolls the page nor
// swipes the face, while a swipe elsewhere still changes it (Review Focus 1).

import { expect, hydrated, sizeOf, test } from "./fixtures";
import { seedLayout, seedRack } from "./map-store";
import { givePantAPhoto, seedCatalog } from "./product-store";

/** A 1×1 PNG, served in place of a product photo. */
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

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
/** The selected tile's trash disc: there while the tile is selected, gone when it isn't. */
const trashDisc = (page: Page, product: string) => page.getByRole("button", { name: `Remove ${product}` });
const pencilDisc = (page: Page, product: string) => page.getByRole("button", { name: `Edit ${product}` });

async function openTable(page: Page) {
  await page.goto("/planograms");
  await page.getByRole("link", { name: /Table 1/ }).click();
  await hydrated(page);
}

async function startDraft(page: Page) {
  await page.getByRole("button", { name: "Start planogram" }).click();
  await expect(page.getByRole("button", { name: "Add product" })).toBeVisible();
}

/** Add places the tee at the first open spot and selects it. */
async function addTee(page: Page) {
  await page.getByRole("button", { name: "Add product" }).click();
  await page.getByLabel("Find a product").fill("E2E Pocket");
  await page.getByRole("button", { name: /E2E Pocket Tee/ }).click();
  await saved(page);
  await expect(trashDisc(page, "E2E Pocket Tee")).toBeVisible();
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
  await expect(trashDisc(page, "E2E High-Rise Pant")).toBeVisible();
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

test("a tile with a photo drags by mouse; the browser doesn't drag the image instead", async ({ page }, info) => {
  test.skip(sizeOf(info) !== "desktop", "A native image drag is a mouse thing.");
  await givePantAPhoto();
  await page.route("**/api/images/**", (route) => route.fulfill({ contentType: "image/png", body: PNG }));
  await openTable(page);
  await startDraft(page);
  await tile(page, "E2E High-Rise Pant").click();
  await expect(tile(page, "E2E High-Rise Pant").locator("img")).toBeVisible();
  const unit = await halfFoot(page);
  await dragBy(page, tile(page, "E2E High-Rise Pant"), unit * 4, 0, info);
  await saved(page);
  await expect(card(page, "E2E High-Rise Pant")).toContainText("Center · Middle");
});

test("the right handle widens a tile half a foot at a time", async ({ page }, info) => {
  await openTable(page);
  await startDraft(page);
  await tile(page, "E2E High-Rise Pant").click();
  const unit = await halfFoot(page);
  await dragBy(page, page.locator('[data-handle="right"]'), unit * 2, 0, info);
  await saved(page);
  await pencilDisc(page, "E2E High-Rise Pant").click();
  await expect(page.getByText("0–3 ft from left · 0–2 ft from back").filter({ visible: true })).toBeVisible();
});

test("an invalid drop snaps back and says why", async ({ page }, info) => {
  await openTable(page);
  await startDraft(page);
  await addTee(page);
  const unit = await halfFoot(page);
  // Measured from the grid, which the refusal's status line (it takes a line when it appears) moves down.
  const spot = async () => {
    const [box, grid] = await Promise.all([tile(page, "E2E Pocket Tee").boundingBox(), page.locator("[data-planogram-grid]").boundingBox()]);
    return box && grid ? { x: box.x - grid.x, y: box.y - grid.y } : null;
  };
  const before = await spot();
  await dragBy(page, tile(page, "E2E Pocket Tee"), -unit * 2, 0, info);
  await expect(page.getByText("Blocked by E2E High-Rise Pant").filter({ visible: true }).first()).toBeVisible();
  await expect(card(page, "E2E Pocket Tee")).toContainText("Center · Middle");
  // The tile itself is back where it started, not left mid-drag.
  await expect(async () => {
    const after = await spot();
    expect(after && before && Math.abs(after.x - before.x) < 2 && Math.abs(after.y - before.y) < 2).toBe(true);
  }).toPass();
});

test("the first drag on a published planogram starts a draft", async ({ page }, info) => {
  await openTable(page);
  await startDraft(page);
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page.getByRole("button", { name: /^Publish to / }).click();
  await expect(page.getByText("Version 1 published", { exact: true })).toBeVisible();
  // Nothing to start: with the published version showing, + is there and Undo, Publish and ⋯ wait for a draft.
  await expect(page.getByRole("button", { name: "Add product" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Undo" })).toHaveCount(0);

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
  // and make sure the start point is in the viewport.
  await front.scrollIntoViewIfNeeded();
  const grid = await front.boundingBox();
  if (!grid) throw new Error("no grid");
  const startY = grid.y + grid.height - 16;
  expect(startY).toBeLessThan(page.viewportSize()?.height ?? Infinity);
  await touchDrag(page, grid.x + grid.width - 24, startY, -160, 0);
  await expect(page.getByRole("region", { name: /Rack 1, Back/ })).toBeVisible();
});

test("on a phone, the selected tile's corner discs are there, no bar takes the screen, and the last card clears the tabs", async ({ page }, info) => {
  test.skip(sizeOf(info) !== "phone", "phone only");
  await openTable(page);
  await startDraft(page);
  await tile(page, "E2E High-Rise Pant").click();
  const trash = trashDisc(page, "E2E High-Rise Pant");
  const pencil = pencilDisc(page, "E2E High-Rise Pant");
  await expect(trash).toBeVisible();
  for (const disc of [trash, pencil]) {
    const box = await disc.boundingBox();
    // 44 px, or smaller only where a resize handle's target would touch it (never under 24 px).
    expect(box && Math.min(box.width, box.height)).toBeGreaterThanOrEqual(24);
  }
  await expect(page.locator("[data-action-bar]")).toHaveCount(0);
  // The corner bar stays where it is.
  await expect(page.getByRole("button", { name: "Add product" })).toBeVisible();

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const tabs = await page.getByRole("navigation", { name: "Main" }).filter({ visible: true }).boundingBox();
  const last = await page.locator("[data-card]").last().boundingBox();
  expect(last && tabs && last.y + last.height <= tabs.y + 1).toBe(true);
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
