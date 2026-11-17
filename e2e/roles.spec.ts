// The Roles screen as a Store Manager (spec 0.7, 4.8 "Roles screen design", parts 2, 3, 5 and 9), at the three
// widths: the grid for this width, staged permission changes with the summary and one save, the nesting rule
// named on the screen, and adding a role. The test account is its home store's Store Manager; the roles
// are put back after every test (roles-store.ts). What the other roles see is in access-managers.spec.ts
// and access-staff.spec.ts.

import { expect, hydrated, test } from "./fixtures";
import { clearPeople, loggedEvents, seedTeam } from "./people-store";
import { act, box, narrow, openRoles, reveal, reviewAndSave, roleOrder } from "./roles-page";
import { resetRoles, storedRoles } from "./roles-store";

test.beforeEach(async () => {
  await seedTeam();
});
test.afterEach(async () => {
  await resetRoles();
  await clearPeople();
});

test("shows the grid for this width, without scrolling the page sideways, with targets of 44 px, and Store Manager read-only", async ({ page }) => {
  await openRoles(page);
  await expect(page.getByText("Every role can view the store: search products and see the map and published planograms.")).toBeVisible();
  expect(await roleOrder(page)).toEqual(["Store Manager", "Assistant Manager", "Visual Merchandising Manager", "Visual Merchandising Worker", "Sales Associate"]);
  if (narrow(page)) {
    await expect(page.getByRole("table")).toHaveCount(0);
    await expect(page.locator("[data-role-fold]")).toHaveCount(5);
  } else {
    await expect(page.getByRole("region", { name: "Permissions by role" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Run sales" })).toBeVisible();
  }
  await reveal(page, "Store Manager");
  // The viewer's own role: always on, locked and read-only; the rows below are editable.
  await expect(box(page, "Run sales", "Store Manager")).toBeDisabled();
  const locked = page.getByRole("checkbox", { name: "Manage people for Store Manager, always on" });
  await expect(locked).toBeChecked();
  await expect(locked).toBeDisabled();
  await expect(page.getByText("Your role").filter({ visible: true }).first()).toBeVisible();
  await reveal(page, "Sales Associate");
  await expect(box(page, "Run sales", "Sales Associate")).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const target = (await box(page, "Run sales", "Sales Associate").locator("xpath=ancestor::label[1]").boundingBox())!;
  expect(target.height).toBeGreaterThanOrEqual(43.5);
  if (!narrow(page)) {
    const menu = (await page.getByRole("button", { name: "More for Sales Associate" }).boundingBox())!;
    expect(menu.height).toBeGreaterThanOrEqual(43.5);
    expect(menu.width).toBeGreaterThanOrEqual(43.5);
  }
});

test("stages a change: tinted and marked Unsaved, menus off, Discard restores; Review lists what changed; one save; logged", async ({ page }) => {
  await openRoles(page);
  await reveal(page, "Sales Associate");
  const stock = box(page, "Mark sold out", "Sales Associate");
  await stock.uncheck();
  await expect(page.getByText(narrow(page) ? "Sales Associate (unsaved)" : "Unsaved", { exact: true }).filter({ visible: true })).toBeVisible();
  await expect(page.getByText("1 role changed").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Add role" })).toBeDisabled();
  if (!narrow(page)) await expect(page.getByRole("button", { name: "More for Sales Associate" })).toBeDisabled();
  await page.getByRole("button", { name: "Discard changes" }).click();
  await page.getByRole("dialog", { name: "Discard your changes?" }).getByRole("button", { name: "Discard changes" }).click();
  await expect(stock).toBeChecked();
  await expect(stock).toBeFocused();
  await expect(page.getByRole("button", { name: "Review and save" })).toHaveCount(0);

  await stock.uncheck();
  const dialog = await reviewAndSave(page, "Save changes to 1 role?");
  await expect(dialog).toContainText("Everyone with these roles gets the change on their next tap. Nobody is signed out.");
  await expect(dialog.getByText("No longer can:")).toBeVisible();
  await expect(dialog).toContainText("Mark a product sold out, or back in stock");
  await expect(dialog.getByText("After saving, Sales Associate can:")).toBeVisible();
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved changes to 1 role").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Review and save" })).toHaveCount(0);
  await expect(stock).toBeFocused();
  expect((await storedRoles()).find((r) => r.name === "Sales Associate")!.switches).not.toContain("products.stock");
  expect((await loggedEvents())[0]).toBe("role_switches_changed");
  await expect(page.getByText(/changed Sales Associate: turned off Mark sold out/)).toBeVisible();
});

test("names the role that blocks a change, holds back Save, and accepts the same column turned off from the bottom up", async ({ page }) => {
  await openRoles(page);
  await reveal(page, "Visual Merchandising Manager");
  const settings = box(page, "Store settings", "Visual Merchandising Manager");
  await settings.check();
  await expect(page.getByText("Assistant Manager can't change store settings, so Visual Merchandising Manager can't either.").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Review and save" })).toBeDisabled();
  await settings.uncheck();
  await expect(page.getByRole("button", { name: "Review and save" })).toHaveCount(0);

  await reveal(page, "Assistant Manager");
  await box(page, "Edit products", "Assistant Manager").uncheck();
  await expect(page.getByText("Visual Merchandising Manager can still edit products; turn it off there first.").first()).toBeVisible();
  await reveal(page, "Visual Merchandising Manager");
  await box(page, "Edit products", "Visual Merchandising Manager").uncheck();
  await expect(page.getByText("can still edit products")).toHaveCount(0);
  const dialog = await reviewAndSave(page, "Save changes to 2 roles?");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved changes to 2 roles").first()).toBeVisible();
  const stored = await storedRoles();
  expect(stored.filter((r) => r.switches.includes("products.edit")).map((r) => r.name)).toEqual(["Store Manager"]);
});

test("renames a role everywhere, refuses a name already used, and returns focus to the row", async ({ page }) => {
  await openRoles(page);
  await act(page, "Sales Associate", "Rename");
  const dialog = page.getByRole("dialog", { name: "Rename Sales Associate" });
  await expect(dialog.getByRole("button", { name: "Save name" })).toBeDisabled();
  await dialog.getByLabel("Name").fill("visual merchandising worker");
  await dialog.getByRole("button", { name: "Save name" }).click();
  await expect(dialog.getByRole("status")).toHaveText("Another role is already called visual merchandising worker.");
  await dialog.getByLabel("Name").fill("Educator");
  await dialog.getByRole("button", { name: "Save name" }).click();
  await expect(page.getByText("Renamed Sales Associate to Educator").first()).toBeVisible();
  await expect.poll(() => roleOrder(page)).toContain("Educator");
  await expect(page.getByRole("button", { name: narrow(page) ? "Rename Educator" : "More for Educator" })).toBeFocused();
  expect((await loggedEvents())[0]).toBe("role_renamed");
  await expect(page.getByText(/renamed Sales Associate to Educator/)).toBeVisible();
});

test("adds a role where chosen: names the role that blocks it until it nests, then places it and focuses it", async ({ page }) => {
  await openRoles(page);
  await page.getByRole("button", { name: "Add role" }).click();
  const dialog = page.getByRole("dialog", { name: "New role" });
  await dialog.getByLabel("Name").fill("Educator");
  await dialog.getByLabel("Place it").selectOption({ label: "Below Visual Merchandising Manager" });
  // Between the Manager and the Worker it must hold at least what the Worker holds.
  await expect(dialog.getByText(/must be able to as well, placed above it\./)).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Add role" })).toBeDisabled();
  for (const permission of ["Mark sold out", "Run sales", "Draft planograms"]) await dialog.getByRole("checkbox", { name: permission }).check();
  await expect(dialog.getByText(/must be able to as well/)).toHaveCount(0);
  await expect(dialog.getByText("Mark a product sold out, or back in stock")).toBeVisible();
  await dialog.getByRole("button", { name: "Add role" }).click();
  await expect(page.getByText("Added Educator").first()).toBeVisible();
  await expect.poll(() => roleOrder(page)).toEqual(["Store Manager", "Assistant Manager", "Visual Merchandising Manager", "Educator", "Visual Merchandising Worker", "Sales Associate"]);
  const made = (await storedRoles()).find((r) => r.name === "Educator")!;
  expect(made).toMatchObject({ rank: 350, builtin: null });
  if (narrow(page)) await expect(page.locator('[data-role-fold="Educator"] h3 button')).toBeFocused();
  else await expect(page.locator('[data-role-name="Educator"]')).toBeFocused();
  expect((await loggedEvents())[0]).toBe("role_created");
  await hydrated(page);
});

test("is reached from People by the Roles and permissions link, and goes back to People", async ({ page }) => {
  await page.goto("/people");
  await hydrated(page);
  await page.getByRole("link", { name: "Roles and permissions" }).click();
  await expect(page).toHaveURL(/\/roles$/);
  await expect(page.getByRole("heading", { level: 1, name: "Roles and permissions" })).toBeVisible();
  await page.getByRole("link", { name: /Back to People|People/ }).first().click();
  await expect(page).toHaveURL(/\/people$/);
});
