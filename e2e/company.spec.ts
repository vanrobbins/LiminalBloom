// /company at phone, tablet and desktop (0.7.1b, B6): the page opens for an owner in a store (inside the shell) and
// for a company person with no store (bare), every control is 44 px, nothing scrolls sideways, and the owner can
// add a region and a store. The people are disposable (company-store.ts); B11 extends this with the other roles.

import { clearCompanies, newEmail, signUpCompanyOnly, signUpOwnerWithStore } from "./company-store";
import { expect, hydrated, test } from "./fixtures";
import { expectLayout } from "./layout-check";

test.use({ storageState: { cookies: [], origins: [] } });
// Sign-up, a company and a store make these longer than the default.
test.setTimeout(90_000);

test.afterEach(clearCompanies);

test("opens for an owner in a store: sections, no sideways scroll, 44 px targets", async ({ page }) => {
  await signUpOwnerWithStore(page, newEmail(), "Company Home Store");
  await expectLayout(page, "/company");
  await expect(page.getByRole("heading", { level: 1, name: "E2E Company" })).toBeVisible();
  for (const name of ["Details", "Regions", "Stores", "Recent changes"]) await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
  // The shell is there: this person has a store.
  await expect(page.locator("#content")).toBeVisible();
  await expect(page.locator("#content").getByText("Company Home Store")).toBeVisible();
});

test("opens bare for a company person with no store, with Help and Sign out", async ({ page }) => {
  await signUpCompanyOnly(page, newEmail());
  await expectLayout(page, "/company");
  await expect(page.getByRole("heading", { level: 1, name: "E2E Company" })).toBeVisible();
  await expect(page.locator("#content")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Help" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  // Signing in or going anywhere else a store person goes leads back here.
  await page.goto("/home");
  await page.waitForURL("**/company");
});

test("a company person with no store opens Account from /company: its cards, their company, no store list, and back", async ({ page }) => {
  await signUpCompanyOnly(page, newEmail());
  await page.goto("/company");
  await hydrated(page);
  await page.getByRole("link", { name: "Account" }).click();
  await page.waitForURL("**/account");
  await expect(page.getByRole("heading", { level: 1, name: "Account" })).toBeVisible();
  for (const name of ["Change password", "Company"]) await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.getByText("E2E Company", { exact: true })).toBeVisible();
  await expect(page.locator("#content")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Create a store" })).toHaveCount(0);
  await page.getByRole("link", { name: /Back/ }).click();
  await page.waitForURL("**/company");
});

test("the owner adds a region, then a store into it, and lands on the store's Home", async ({ page }) => {
  await signUpOwnerWithStore(page, newEmail(), "Region Home Store");
  await page.goto("/company");
  await hydrated(page);

  await page.getByRole("button", { name: "Add region" }).click();
  await page.getByRole("dialog").getByLabel("Name").fill("South");
  await page.getByRole("dialog").getByRole("button", { name: "Add region" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Regions" }).getByText("South")).toBeVisible();

  await page.getByRole("button", { name: "Add store" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Store name").fill("Company Added Store");
  await dialog.getByLabel("Region").selectOption({ label: "South" });
  await dialog.getByRole("button", { name: "Add store" }).click();
  await page.waitForURL("**/home");
  // Its name is on the page for every size (visible in the header or sidebar, or read by the rail).
  await expect(page.getByText("Company Added Store").first()).toBeAttached();
});
