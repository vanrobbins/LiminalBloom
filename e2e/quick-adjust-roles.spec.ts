// Quick Adjust by role (0.7.0.9 spec §3, §9): a VM Worker drafts but cannot publish or revert, a Sales Associate is turned
// away. The role store keeps no layout (access-staff asserts it), so the worker's own account takes the role in its own
// store for the test (quick-adjust-store.ts: actAs; the role is read afresh on each request) and goes back to Store Manager.

import { expect, sizeOf, test } from "./fixtures";
import { resetLayout } from "./map-store";
import { adjustAndPublish, bar, choose, closePanel, openAdjust } from "./quick-adjust-page";
import { actAs, adjustmentStates, SLIM, seedAdjustable, type AdjustSeed } from "./quick-adjust-store";

let seed: AdjustSeed;
test.beforeEach(async () => {
  seed = await seedAdjustable();
});
test.afterEach(() => actAs("store_manager"));
test.afterAll(() => resetLayout());

test("a VM Worker can draft a Quick Adjust but has no Publish, and the draft waits for a publisher", async ({ page }, info) => {
  await actAs("vm_worker");
  await openAdjust(page, seed);
  await choose(page, new RegExp(`^${SLIM}`));
  await closePanel(page, sizeOf(info) === "phone");
  await expect(bar(page).getByRole("button", { name: "Discard" })).toBeVisible();
  await expect(bar(page).getByRole("button", { name: "Compare" })).toBeVisible();
  await expect(bar(page).getByRole("button", { name: "Publish" })).toHaveCount(0);
  expect(await adjustmentStates(seed)).toEqual(["draft"]);

  // A publisher finds it on the planogram.
  await actAs("store_manager");
  await page.goto(`/planograms/${seed.fixtureId}`);
  await expect(page.locator('[data-adjustment="draft"]')).toContainText("Quick Adjust draft");
  await expect(page.getByRole("link", { name: "Open Quick Adjust draft" })).toBeVisible();
});

test("a VM Worker sees a published Quick Adjust and can edit it, but cannot revert it", async ({ page }, info) => {
  await adjustAndPublish(page, seed, sizeOf(info) === "phone");
  await actAs("vm_worker");
  await page.goto(`/planograms/${seed.fixtureId}`);
  const line = page.locator('[data-adjustment="published"]');
  await expect(line).toBeVisible();
  await expect(line.getByRole("button", { name: "Compare Quick Adjust" })).toBeVisible();
  await expect(line.getByRole("link", { name: "Edit Quick Adjust" })).toBeVisible();
  await expect(line.getByRole("button", { name: "Revert Quick Adjust" })).toHaveCount(0);
});

test("a Sales Associate gets no access to the adjust page and no Edit on the planogram", async ({ page }, info) => {
  await adjustAndPublish(page, seed, sizeOf(info) === "phone");
  await actAs("sales_associate");
  await page.goto(seed.adjustUrl);
  await expect(page).toHaveURL(/\/no-access$/);
  await page.goto(`/planograms/${seed.fixtureId}`);
  const line = page.locator('[data-adjustment="published"]');
  await expect(line.getByRole("button", { name: "Compare Quick Adjust" })).toBeVisible();
  await expect(line.getByRole("link", { name: "Edit Quick Adjust" })).toHaveCount(0);
  await expect(line.getByRole("button", { name: "Revert Quick Adjust" })).toHaveCount(0);
});
