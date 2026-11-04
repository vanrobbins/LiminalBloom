// Tooltips and "What's this?" popovers (Week 6.5 spec §5.4): icon-only buttons
// name themselves on hover and on keyboard focus; ⓘ opens on a tap and closes
// with Escape.

import { expect, hydrated, sizeOf, test } from "./fixtures";
import { seedLayout } from "./map-store";
import { seedCatalog } from "./product-store";

test.beforeEach(async () => {
  await seedLayout();
  await seedCatalog();
});

test("an icon-only button shows its name on hover and on keyboard focus", async ({ page }) => {
  test.skip(sizeOf(test.info()) !== "desktop", "Hover and a keyboard are the desktop's.");
  // Zoom buttons are for screens under 1024 px; a mouse can still be on one.
  await page.setViewportSize({ width: 1000, height: 800 });
  await page.goto("/layout");
  await hydrated(page);
  const zoomIn = page.getByRole("button", { name: "Zoom in" }).filter({ visible: true });
  await zoomIn.hover();
  await expect(page.getByRole("tooltip", { name: "Zoom in" })).toBeVisible();
  // Radix waits for the next move: the pointer may be crossing to the tooltip.
  await page.mouse.move(0, 0);
  await page.mouse.move(5, 5);
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await zoomIn.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("tooltip", { name: "Zoom in" })).toBeVisible();
});

test("a ⓘ opens its explanation on a tap and closes with Escape", async ({ page }) => {
  await page.goto("/planograms");
  await hydrated(page);
  const info = page.getByRole("button", { name: "What's planogram?" }).filter({ visible: true });
  if (test.info().project.use.hasTouch) await info.tap();
  else await info.click();
  await expect(page.getByText("The plan for what goes where on a fixture.", { exact: false })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText("The plan for what goes where on a fixture.", { exact: false })).toBeHidden();
});
