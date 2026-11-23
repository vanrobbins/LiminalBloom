// /company at phone, tablet and desktop (0.7.1b, B6): the page opens for an owner in a store (inside the shell) and
// for a company person with no store (bare), every control is 44 px, nothing scrolls sideways, and the owner can
// add a region and a store. The people are disposable (company-store.ts); B11 extends this with the other roles.

import { clearCompanies, newEmail, signUpCompanyOnly, signUpOwnerWithStore } from "./company-store";
import { expect, hydrated, test } from "./fixtures";
import { signUp, visitor } from "./invite-page";
import { expectLayout } from "./layout-check";
import { sql } from "./map-store";

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

test("the owner invites a regional manager by link; they sign up, accept, land in the region's store and see it read-only", async ({ page, browser }) => {
  await signUpOwnerWithStore(page, newEmail(), "Invite Home Store");
  const email = newEmail();
  await page.goto("/company");
  await hydrated(page);

  const people = page.getByRole("region", { name: "People" });
  await people.getByRole("button", { name: "Invite" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Email").fill(email);
  await expect(dialog.getByLabel("Role")).toHaveValue("regional_manager");
  await expect(dialog.getByLabel("Region")).toContainText("North");
  await dialog.getByRole("button", { name: "Create invite link" }).click();
  const link = await dialog.getByLabel("Invite link").inputValue();
  expect(link).toMatch(/\/invite\/[A-Za-z0-9_-]{32,}$/);
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(people.getByRole("button", { name: `Copy link for ${email}` })).toBeVisible();

  const guest = await visitor(browser, page);
  await guest.page.goto(link);
  await expect(guest.page.getByRole("heading", { level: 1, name: "Join E2E Company" })).toBeVisible();
  await expect(guest.page.getByText(email)).toHaveCount(0);
  await guest.page.getByRole("link", { name: "Create an account" }).click();
  await signUp(guest.page, email);
  await guest.page.getByRole("button", { name: "Accept invitation" }).click();
  await guest.page.waitForURL("**/home");

  // Every company role asks for two-factor (DECISIONS 11-23); the e2e accounts are flagged as having it, as company-store.ts does.
  await sql()`update "user" set two_factor_enabled = true where email = ${email}`;
  // A regional manager holds no company switch: Details and Stores only, and their role and region in Details.
  await guest.page.goto("/company");
  await hydrated(guest.page);
  await expect(guest.page.getByText("Regional Manager · North")).toBeVisible();
  await expect(guest.page.getByRole("region", { name: "People" })).toHaveCount(0);
  await expect(guest.page.getByRole("button", { name: "Add store" })).toHaveCount(0);
  await guest.context.close();

  // The owner's People now lists them, with the waiting invitation gone.
  await page.reload();
  await hydrated(page);
  await expect(people.getByText("Regional Manager · North")).toBeVisible();
  await expect(people.getByRole("button", { name: `Copy link for ${email}` })).toHaveCount(0);
});
