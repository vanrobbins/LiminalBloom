// The prototype walkthrough (/prototype, branch feature/prototype-walkthrough):
// public, moves between chapters by button, key and link, and ties each
// numbered dot on the drawing to its point in the text.

import { expect, test } from "./fixtures";

test.use({ storageState: { cookies: [], origins: [] } });

test("opens on the first chapter without signing in", async ({ page }) => {
  await page.goto("/prototype");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Keep the floor matching the plan");
});

test("Next and the arrow keys move between chapters and update the link", async ({ page }) => {
  await page.goto("/prototype");
  await page.getByRole("button", { name: /^Next:/ }).click();
  await expect(page).toHaveURL(/#sign-in$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Getting in, and choosing a store");

  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/#store-map$/);
  await page.keyboard.press("ArrowLeft");
  await expect(page).toHaveURL(/#sign-in$/);
});

test("a chapter link opens that chapter", async ({ page }) => {
  await page.goto("/prototype#quick-adjust");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Quick Adjust: the core loop");
});

test("tapping a dot on the drawing lights its point in the text", async ({ page }) => {
  await page.goto("/prototype#planograms");
  const point = page.getByRole("button", { name: /^Undo/ });
  await expect(point).toHaveAttribute("aria-pressed", "false");

  await page.getByRole("button", { name: "Point 4", exact: true }).click();
  await expect(point).toHaveAttribute("aria-pressed", "true");
});

test("the page never scrolls sideways", async ({ page }) => {
  for (const id of ["welcome", "locator", "frame-racks", "request-path"]) {
    await page.goto(`/prototype#${id}`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, id).toBeLessThanOrEqual(0);
  }
});
