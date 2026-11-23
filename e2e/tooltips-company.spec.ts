// Icon-only controls on the company screens (0.7.1b, B11): each names itself to a screen reader, and the
// row menus on /company are 44 px and show their name on hover. A disposable company with a regional manager
// to act on (company-store.ts); the other tooltip checks are in tooltips.spec.ts.

import { clearCompanies, grantCompanyRole, newEmail, signUpOwnerWithStore, signUpPlain } from "./company-store";
import { expect, hydrated, sizeOf, test } from "./fixtures";
import { expectIconsNamed } from "./tooltip-steps";

test.use({ storageState: { cookies: [], origins: [] } });
test.setTimeout(120_000);
test.afterEach(clearCompanies);

test("/company and /request-company: every icon-only control has an aria-label; a row menu is a 44 px icon with a tooltip", async ({ page, browser }, testInfo) => {
  const owner = newEmail();
  await signUpOwnerWithStore(page, owner, "Tooltip Company Store", "Tooltip Co");
  const guest = await browser.newContext({ viewport: page.viewportSize()!, storageState: { cookies: [], origins: [] } });
  try {
    const regional = newEmail();
    await signUpPlain(await guest.newPage(), regional, "Tess Tooltip");
    await grantCompanyRole(regional, owner, "regional_manager", "North");
  } finally {
    await guest.close();
  }
  await page.goto("/company");
  await hydrated(page);
  await expect(page.getByRole("heading", { level: 1, name: "Tooltip Co" })).toBeVisible();
  await expectIconsNamed(page);

  const menu = page.getByRole("button", { name: "More for Tess Tooltip", exact: true }).filter({ visible: true });
  await expect(menu).toBeVisible();
  await expect(menu).toHaveText("");
  const box = (await menu.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(43.5);
  expect(box.height).toBeGreaterThanOrEqual(43.5);
  if (sizeOf(testInfo) === "desktop") {
    await menu.hover();
    await expect(page.getByRole("tooltip", { name: "More for Tess Tooltip" })).toBeVisible();
  }

  await page.goto("/request-company");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectIconsNamed(page);
});
