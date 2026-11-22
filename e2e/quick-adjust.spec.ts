// Quick Adjust (0.7.0.9 spec §9): a sold-out product becomes a published adjustment, on the worker's own store (Table 1
// published as Version 1, quick-adjust-store.ts). The core loop, Leave empty and Undo, Revert and a monthly publish ending
// it run at the three sizes; Compare and the warnings are in quick-adjust-compare.spec.ts, the role gates in
// quick-adjust-roles.spec.ts.

import { expect, sizeOf, test } from "./fixtures";
import { resetLayout } from "./map-store";
import { adjustAndPublish, bar, choose, closePanel, openAdjust, tile } from "./quick-adjust-page";
import { adjustmentStates, floorNames, PANT, seedAdjustable, SLIM, startMonthlyDraft, type AdjustSeed } from "./quick-adjust-store";

let seed: AdjustSeed;
test.beforeEach(async () => {
  seed = await seedAdjustable();
});
test.afterAll(() => resetLayout());

const MINUTES = 2 * 60_000;
const productCard = (page: import("@playwright/test").Page, name: string) => page.getByRole("main").getByRole("list").first().getByRole("button", { name: new RegExp(`^${name}`) });

test("sold out to a published Quick Adjust in under two minutes, and Products says where it went", async ({ page }, info) => {
  const phone = sizeOf(info) === "phone";
  const started = Date.now();
  await page.goto("/products?q=E2E-HRP-01");
  await productCard(page, PANT).click();
  await page.getByRole("radio", { name: "Sold out" }).click();
  await expect(page.getByRole("radio", { name: "Sold out" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText("Sold out. On 1 display.", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: /^Quick Adjust on Table 1/ }).filter({ visible: true }).click();
  await expect(page).toHaveURL(new RegExp(`/planograms/${seed.fixtureId}/adjust\\?product=${seed.pantId}$`));

  // The panel is open on the sold-out tile and the first suggestion is the in-stock pant of the same colour.
  await expect(page.getByRole("radiogroup", { name: "Replace with" }).getByRole("radio").nth(1)).toContainText(`${SLIM}Same category and colour`);
  await choose(page, new RegExp(`^${SLIM}`));
  await closePanel(page, phone);
  await expect(tile(page, `${SLIM}, replaces ${PANT}`)).toBeVisible();
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByRole("heading", { name: /^Publish to / })).toBeVisible();
  await page.getByRole("button", { name: /^Publish to / }).click();
  await expect(page).toHaveURL(new RegExp(`/planograms/${seed.fixtureId}$`));
  await expect(page.locator('[data-adjustment="published"]')).toContainText("Quick Adjust · since");
  expect(Date.now() - started, "sold out to published, as a guard and not a benchmark").toBeLessThan(MINUTES);

  expect(await adjustmentStates(seed)).toEqual(["published"]);
  expect(await floorNames(seed)).toEqual([SLIM]);
  await page.goto(`/products?q=${SLIM.replace(/ /g, "+")}`);
  await productCard(page, SLIM).click();
  await expect(page.getByText("Table 1 · Left · Middle", { exact: true }).last()).toBeVisible();
  await page.goto("/products?q=E2E-HRP-01");
  await productCard(page, PANT).click();
  await expect(page.getByText("Off Table 1 for a Quick Adjust", { exact: true })).toBeVisible();
  await expect(page.getByText(/Not placed yet/)).toHaveCount(0);
});

test("Leave empty draws the tile as empty, and Undo puts the pant back", async ({ page }, info) => {
  await openAdjust(page, seed);
  await choose(page, "Leave empty");
  await closePanel(page, sizeOf(info) === "phone");
  await expect(tile(page, `Empty, was ${PANT}`)).toBeVisible();
  await bar(page).getByRole("button", { name: "Undo" }).click();
  await expect(tile(page, new RegExp(`^${PANT}`))).toBeVisible();
  await expect(tile(page, `Empty, was ${PANT}`)).toBeHidden();
  await bar(page).getByRole("button", { name: "Redo" }).click();
  await expect(tile(page, `Empty, was ${PANT}`)).toBeVisible();
});

test("Revert puts Version 1 back: the pant is on the floor again and the line is gone", async ({ page }, info) => {
  await adjustAndPublish(page, seed, sizeOf(info) === "phone");
  expect(await floorNames(seed)).toEqual([SLIM]);
  await page.locator('[data-adjustment="published"]').getByRole("button", { name: "Revert Quick Adjust" }).click();
  await expect(page.getByRole("heading", { name: "Put Version 1 back on the floor?" })).toBeVisible();
  await page.getByRole("button", { name: "Revert", exact: true }).click();
  await expect(page.locator('[data-adjustment="published"]')).toHaveCount(0);
  expect(await adjustmentStates(seed)).toEqual(["ended:reverted"]);
  expect(await floorNames(seed)).toEqual([PANT]);
});

test("a monthly publish ends the Quick Adjust and its dialog says so", async ({ page }, info) => {
  await adjustAndPublish(page, seed, sizeOf(info) === "phone");
  await startMonthlyDraft(seed);
  await page.goto(`/planograms/${seed.fixtureId}`);
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByText(`Ends the Quick Adjust: ${PANT} → ${SLIM} (Table 1)`)).toBeVisible();
  await page.getByRole("button", { name: /^Publish to / }).click();
  await expect(page.getByText("Version 2 published", { exact: true })).toBeVisible();
  expect(await adjustmentStates(seed)).toEqual(["ended:new_version"]);
  await expect(page.locator('[data-adjustment="published"]')).toHaveCount(0);
  expect(await floorNames(seed)).toEqual([PANT]);
});
