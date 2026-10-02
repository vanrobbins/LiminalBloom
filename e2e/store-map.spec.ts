// The store map at phone, tablet and desktop, light and dark (spec §11).
// Every test starts from a known layout in the home store.

import type { Page } from "@playwright/test";

import { expect, sizeOf, switchStore, test } from "./fixtures";
import { layoutCounts, resetLayout, seedLayout } from "./map-store";
import { HOME_STORE, SECOND_STORE } from "./test-account";

const map = (page: Page) => page.getByRole("img", { name: /^Store layout:/ });
const fixtureShape = (page: Page, name: string) => page.locator(`[data-fixture-name="${name}"]`);

async function centreOf(page: Page, selector: string) {
  const box = (await page.locator(selector).first().boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
}

async function saved(page: Page) {
  await expect(page.getByRole("status").filter({ hasText: /^Saved$/, visible: true })).toBeVisible({ timeout: 10_000 });
}

/** The editor's client code is running: React attaches its props to the map once it hydrates. */
async function hydrated(page: Page) {
  await page.waitForFunction(() => {
    const svg = document.querySelector("svg[role=img]");
    return svg !== null && Object.keys(svg).some((key) => key.startsWith("__reactProps"));
  });
}

/** On a phone the properties panel rests over the lower map and the bottom bar: close it to reach them. */
async function closePeek(page: Page) {
  if (sizeOf(test.info()) !== "phone") return;
  const panel = page.getByRole("region", { name: "Selected" });
  if (await panel.isVisible()) await panel.getByRole("button", { name: "Close" }).click();
  await expect(panel).toBeHidden();
}

/** The phone's properties panel rests low; its handle raises it to reach the lower controls. */
async function expandPeek(page: Page) {
  if (sizeOf(test.info()) !== "phone") return;
  const handle = page.getByRole("region", { name: "Selected" }).getByRole("button", { name: "Expand" });
  await handle.click();
  await expect(page.getByRole("region", { name: "Selected" }).getByRole("button", { name: "Collapse" })).toHaveAttribute("aria-expanded", "true");
}

/** + Add in whichever form the screen size has. */
async function add(page: Page, label: string) {
  const size = sizeOf(test.info());
  if (size === "desktop") {
    await page.getByRole("region", { name: "Add to the map" }).getByRole("button", { name: label, exact: true }).click();
  } else if (size === "tablet") {
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await page.getByRole("menuitem", { name: label, exact: true }).click();
  } else {
    await closePeek(page);
    await page.getByRole("navigation", { name: "Editor" }).getByRole("button", { name: "Add", exact: true }).click();
    const sheet = page.getByRole("dialog", { name: "Add to the map" });
    await sheet.getByRole("button", { name: label, exact: true }).click();
    // Until the sheet has gone, its overlay takes the presses meant for the map.
    await expect(sheet).toBeHidden();
  }
}

/** Select an item from the list in whichever form the screen size has. */
async function choose(page: Page, label: RegExp) {
  if (sizeOf(test.info()) === "phone") {
    // Choosing an item closes the list sheet (Task 23).
    await page.getByRole("button", { name: "List" }).click();
    await page.getByRole("dialog", { name: "Everything on the map" }).getByRole("button", { name: label }).click();
  } else {
    await page.getByRole("navigation", { name: "Everything on the map" }).first().getByRole("button", { name: label }).click();
  }
}

test.describe("first-time setup", () => {
  test.beforeEach(async () => resetLayout());

  test("a rectangle outline is created and survives a reload", async ({ page }) => {
    await page.goto("/layout");
    await page.getByRole("link", { name: "Set up your store layout" }).click();
    const setup = page.getByRole("dialog", { name: "Set up your store" });
    await setup.getByRole("button", { name: "Create outline" }).click();
    await expect(setup).toBeHidden();
    await saved(page);
    await page.reload();
    await expect(page.getByRole("dialog", { name: "Set up your store" })).toBeHidden();
    await expect(page.locator("[data-outline]")).toBeVisible();
  });

  test("a custom outline is drawn corner by corner", async ({ page }) => {
    await page.goto("/layout/edit");
    await page.getByRole("button", { name: "Draw it corner by corner" }).click();
    const box = (await map(page).boundingBox())!;
    // Kept clear of the drawing bar along the top and the zoom buttons at the bottom right.
    const corners = [
      [0.25, 0.35],
      [0.7, 0.35],
      [0.7, 0.55],
      [0.5, 0.55],
      [0.5, 0.75],
      [0.25, 0.75],
      [0.25, 0.35],
    ];
    for (const [fx, fy] of corners) await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
    await expect(page.locator("[data-outline]")).toBeVisible();
    await saved(page);
  });
});

test.describe("editing", () => {
  test.beforeEach(async () => seedLayout());

  test("an overlapping drop snaps back and names the blocker", async ({ page }) => {
    await page.goto("/layout/edit");
    await hydrated(page);
    // Added at the overview, the rack lands on the store floor, so it drags straight away.
    await add(page, "Rack");
    await expect(fixtureShape(page, "Rack 1")).toBeVisible();
    await closePeek(page);
    const before = await fixtureShape(page, "Rack 1").getAttribute("transform");
    await drag(page, await centreOf(page, '[data-fixture-name="Rack 1"]'), await centreOf(page, '[data-fixture-name="Table 1"]'));
    await expect(page.getByText("Blocked by Table 1.", { exact: true })).toBeVisible();
    await expect(fixtureShape(page, "Rack 1")).toHaveAttribute("transform", before!);
  });

  test("a move can be undone and redone, and is saved", async ({ page }) => {
    await page.goto("/layout/edit");
    const before = await fixtureShape(page, "Table 1").getAttribute("transform");
    const from = await centreOf(page, '[data-fixture-name="Table 1"]');
    await hydrated(page);
    await drag(page, from, { x: from.x, y: from.y + 60 });
    await expect(fixtureShape(page, "Table 1")).not.toHaveAttribute("transform", before!);
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(fixtureShape(page, "Table 1")).toHaveAttribute("transform", before!);
    await page.getByRole("button", { name: "Redo" }).click();
    const after = await fixtureShape(page, "Table 1").getAttribute("transform");
    expect(after).not.toBe(before);
    await saved(page);
    await page.reload();
    await expect(fixtureShape(page, "Table 1")).toHaveAttribute("transform", after!);
  });

  test("a lower table and a second rack side can be added from the panel", async ({ page }) => {
    await page.goto("/layout/edit");
    await choose(page, /Table 1/);
    await expandPeek(page);
    await page.getByRole("button", { name: "Lower table on the front" }).click();
    await expect(fixtureShape(page, "Table 1 · Front")).toBeVisible();

    await add(page, "Rack");
    await expandPeek(page);
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page.getByText("Back grid").filter({ visible: true })).toBeVisible();
    await saved(page);
  });

  test("Done returns to a map nobody can drag", async ({ page }) => {
    await page.goto("/layout/edit");
    await page.getByRole("button", { name: "Done" }).click();
    await page.waitForURL("**/layout");
    await hydrated(page);
    const before = await fixtureShape(page, "Table 1").getAttribute("transform");
    const from = await centreOf(page, '[data-fixture-name="Table 1"]');
    await drag(page, from, { x: from.x + 80, y: from.y });
    await expect(fixtureShape(page, "Table 1")).toHaveAttribute("transform", before!);
    // No edit began, so nothing is saving either.
    await expect(page.getByRole("status").filter({ hasText: /Saving|Saved/ })).toHaveCount(0);
  });
});

test.describe("touch", () => {
  test.beforeEach(async () => seedLayout());

  test("pinching zooms, and a pinch during a drag moves nothing", async ({ page }) => {
    test.skip(sizeOf(test.info()) === "desktop", "touch sizes only");
    await page.goto("/layout/edit");
    const cdp = await page.context().newCDPSession(page);
    const box = (await map(page).boundingBox())!;
    const world = page.locator("svg[role=img] > g").first();
    const zoomBefore = await world.getAttribute("transform");
    const table = await centreOf(page, '[data-fixture-name="Table 1"]');
    const tableBefore = await fixtureShape(page, "Table 1").getAttribute("transform");

    const touch = (type: "touchStart" | "touchMove" | "touchEnd", points: { x: number; y: number; id: number }[]) =>
      cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points.map((p) => ({ x: p.x, y: p.y, id: p.id })) });

    // One finger starts dragging the table, a second lands and spreads.
    await touch("touchStart", [{ ...table, id: 1 }]);
    await touch("touchMove", [{ x: table.x + 20, y: table.y, id: 1 }]);
    // High on the map: a selected table opens a sheet over the lower part on a phone.
    const second = { x: box.x + box.width * 0.8, y: box.y + box.height * 0.2 };
    await touch("touchStart", [{ x: table.x + 20, y: table.y, id: 1 }, { ...second, id: 2 }]);
    // Spread in small steps, as a hand does: a single jump is only the first reading.
    for (let i = 1; i <= 10; i++) {
      await touch("touchMove", [{ x: table.x + 20 - i * 4, y: table.y - i * 2, id: 1 }, { x: second.x + i * 4, y: second.y - i * 4, id: 2 }]);
      await page.waitForTimeout(16);
    }
    await touch("touchEnd", []);

    await expect(world).not.toHaveAttribute("transform", zoomBefore!);
    await expect(fixtureShape(page, "Table 1")).toHaveAttribute("transform", tableBefore!);
  });
});

test.describe("saving", () => {
  test.beforeEach(async () => seedLayout());

  test("rapid nudges never have two saves in flight", async ({ page }) => {
    test.skip(sizeOf(test.info()) !== "desktop", "keyboard shortcuts are desktop");
    let inFlight = 0;
    let most = 0;
    // Saves are the server-action posts carrying a change set; fetches on focus are not.
    const isSave = (request: { method(): string; headers(): Record<string, string>; postData(): string | null }) =>
      request.method() === "POST" && Boolean(request.headers()["next-action"]) && (request.postData() ?? "").includes("expectedVersion");
    page.on("request", (request) => {
      if (isSave(request)) most = Math.max(most, ++inFlight);
    });
    const done = (request: { method(): string; headers(): Record<string, string>; postData(): string | null }) => {
      if (isSave(request)) inFlight--;
    };
    page.on("requestfinished", done);
    page.on("requestfailed", done);

    await page.goto("/layout/edit");
    await page.locator('[data-fixture-name="Table 1"]').click();
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(80);
    }
    await saved(page);
    expect(most).toBe(1);
  });

  test("a store switched in another tab stops this tab from saving (Review Focus 1)", async ({ page, context }) => {
    test.skip(sizeOf(test.info()) !== "desktop", "one size is enough");
    await resetLayout(SECOND_STORE);
    await page.goto("/layout/edit");
    const other = await context.newPage();
    await other.goto("/products");
    await switchStore(other, SECOND_STORE);
    try {
      await page.locator('[data-fixture-name="Table 1"]').click();
      // The editor reloads on its own, so the next page load is the proof.
      const reloaded = page.waitForEvent("load", { timeout: 10_000 });
      await page.keyboard.press("ArrowRight");
      await expect(page.getByText("You switched stores in another tab.", { exact: true })).toBeVisible({ timeout: 10_000 });
      await reloaded;
      // Refused: nothing moved in the home store, nothing arrived in the other.
      expect(await layoutCounts(HOME_STORE)).toEqual({ fixtures: 1, table1X: 360 });
      expect((await layoutCounts(SECOND_STORE)).fixtures).toBe(0);
    } finally {
      await switchStore(other, HOME_STORE);
      await other.close();
    }
  });
});
