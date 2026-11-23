// Tooltips on the Quick Adjust icons (0.7.0.9 plan task 8, row 8; a file of its own so tooltips.spec.ts stays under the
// size limit). The adjust page's bar and the Published view's adjusted line are icon-only controls: each a 44 px square
// named by its aria-label, and (desktop) the same name as a tooltip on hover. Table 1 is published as Version 1 on the
// worker's own store (quick-adjust-store.ts).

import type { Page } from "@playwright/test";

import { expect, hydrated, sizeOf, test } from "./fixtures";
import { resetLayout } from "./map-store";
import { adjustAndPublish, closePanel, openAdjust } from "./quick-adjust-page";
import { seedAdjustable } from "./quick-adjust-store";

test.afterAll(() => resetLayout());

// Every visible control with no text of its own names itself (the same sweep as tooltips.spec.ts).
async function expectIconsNamed(page: Page) {
  const bare = await page.locator("button:visible, a[href]:visible, [role=menuitem]:visible").evaluateAll((els) =>
    els.filter((e) => !(e as HTMLElement).innerText.trim()).map((e) => ({ label: e.getAttribute("aria-label"), html: e.outerHTML.slice(0, 100) })),
  );
  for (const control of bare) expect(control.label, control.html).toBeTruthy();
}

async function expectSweptIcon(page: Page, name: string, role: "button" | "link" = "button") {
  const control = page.getByRole(role, { name, exact: true }).filter({ visible: true });
  await expect(control).toBeVisible();
  await expect(control).toHaveText("");
  const box = (await control.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(43.5);
  expect(box.height).toBeGreaterThanOrEqual(43.5);
  if (sizeOf(test.info()) !== "desktop") return;
  await control.hover();
  await expect(page.getByRole("tooltip", { name })).toBeVisible();
  await page.mouse.move(0, 0);
  await page.mouse.move(5, 5);
  // Radix keeps a tooltip open while the pointer is in the grace area toward it; a far corner leaves it.
  await page.mouse.move(page.viewportSize()!.width - 5, 5);
  await expect(page.getByRole("tooltip")).toHaveCount(0);
}

test("the adjust page's bar: Undo, Redo, Compare, Publish and Discard are named icons", async ({ page }) => {
  await openAdjust(page, await seedAdjustable());
  await closePanel(page, sizeOf(test.info()) === "phone");
  await expectIconsNamed(page);
  for (const name of ["Undo", "Redo", "Compare", "Publish", "Discard"]) await expectSweptIcon(page, name);
});

test("the Published view's adjusted line: Compare, Edit and Revert are named icons", async ({ page }) => {
  await adjustAndPublish(page, await seedAdjustable(), sizeOf(test.info()) === "phone");
  await hydrated(page);
  await expectIconsNamed(page);
  await expectSweptIcon(page, "Compare Quick Adjust");
  await expectSweptIcon(page, "Edit Quick Adjust", "link");
  await expectSweptIcon(page, "Revert Quick Adjust");
});
