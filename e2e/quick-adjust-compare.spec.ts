// Quick Adjust, Compare and the publish dialog (0.7.0.9 spec §5.3, §9): Before above After below 1024 px and side by side
// from it, the sold-out warning before a publish, and the adjust page fitting each screen with 44 px controls. Table 1 is
// published as Version 1 on the worker's own store (quick-adjust-store.ts).

import type { Page } from "@playwright/test";

import { expect, sizeOf, test } from "./fixtures";
import { resetLayout } from "./map-store";
import { adjustAndPublish, bar, choose, closePanel, openAdjust } from "./quick-adjust-page";
import { markStatus, PANT, seedAdjustable, SLIM, type AdjustSeed } from "./quick-adjust-store";

let seed: AdjustSeed;
test.beforeEach(async () => {
  seed = await seedAdjustable();
});
test.afterAll(() => resetLayout());

/** The two figures of an open Compare, as their captions and boxes. */
async function figures(page: Page) {
  const both = page.locator("[data-compare-grids] figure");
  await expect(both).toHaveCount(2);
  const [before, after] = await Promise.all([both.nth(0).boundingBox(), both.nth(1).boundingBox()]);
  if (!before || !after) throw new Error("Compare is not drawn");
  return { before, after, captions: await both.locator("figcaption").allTextContents() };
}

function expectLayout(page: Page, { before, after }: Awaited<ReturnType<typeof figures>>) {
  const width = page.viewportSize()?.width ?? 0;
  if (width >= 1024) {
    expect(after.x, "After sits to the right of Before").toBeGreaterThan(before.x + before.width - 2);
    expect(Math.abs(after.y - before.y)).toBeLessThan(4);
  } else {
    expect(after.y, "After sits below Before").toBeGreaterThan(before.y + before.height - 2);
    expect(Math.abs(after.x - before.x)).toBeLessThan(4);
    expect(after.width, "no sideways scroll inside the sheet").toBeLessThanOrEqual(width);
  }
}

test("Compare from the bar lists the change in words and draws Before and After stacked or side by side", async ({ page }, info) => {
  await openAdjust(page, seed);
  await choose(page, new RegExp(`^${SLIM}`));
  await closePanel(page, sizeOf(info) === "phone");
  await bar(page).getByRole("button", { name: "Compare" }).click();
  await expect(page.getByRole("dialog", { name: "Compare" })).toContainText(`${PANT} → ${SLIM}`);
  const drawn = await figures(page);
  expect(drawn.captions).toEqual(["Before · Version 1", "After"]);
  expectLayout(page, drawn);
});

test("Compare on the Published view looks at the published Quick Adjust the same way", async ({ page }, info) => {
  await adjustAndPublish(page, seed, sizeOf(info) === "phone");
  await page.getByRole("button", { name: "Compare Quick Adjust" }).click();
  const drawn = await figures(page);
  expect(drawn.captions).toEqual(["Before · Version 1", "After · Quick Adjust"]);
  expectLayout(page, drawn);
  await expect(page.getByRole("button", { name: /^Publish to / })).toHaveCount(0); // it only looks
});

test("the publish dialog warns of a replacement that sold out", async ({ page }, info) => {
  await openAdjust(page, seed);
  await choose(page, new RegExp(`^${SLIM}`));
  await closePanel(page, sizeOf(info) === "phone");
  await markStatus(seed, seed.slimId, "sold_out");
  await bar(page).getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText(`${SLIM} is sold out and is still on the floor.`)).toBeVisible();
  await expect(page.getByRole("button", { name: /^Publish to / })).toBeVisible();
});

test("the adjust page fits the screen and its bar buttons are 44 px", async ({ page }, info) => {
  await openAdjust(page, seed);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await closePanel(page, sizeOf(info) === "phone"); // a phone's open sheet hides the bar from the accessibility tree
  const buttons = bar(page).getByRole("button");
  await expect(buttons).toHaveCount(5); // Undo, Redo, Compare, Publish, Discard
  for (let i = 0; i < 5; i++) {
    const box = await buttons.nth(i).boundingBox();
    if (!box) throw new Error(`button ${i} is not drawn`);
    expect(box.width, `button ${i} width`).toBeGreaterThanOrEqual(43.5);
    expect(box.height, `button ${i} height`).toBeGreaterThanOrEqual(43.5);
  }
});
