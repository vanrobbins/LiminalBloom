// A company's people through the owner's screens (0.7.1b, B11; spec 15, B7): the one-company refusal at an
// invitation link, Change region (the regional manager's reach moves at once), Remove, and the owner's hand-off.
// Every person is a disposable account in a browser of their own; the roles are written in the database
// (company-store.ts) where the invitation itself is not what is tested.

import type { Page } from "@playwright/test";

import { addRegionAndStore, clearCompanies, grantCompanyRole, newEmail, newGuest, signUpCompanyOnly, signUpOwnerWithStore, signUpPlain } from "./company-store";
import { expect, hydrated, test } from "./fixtures";
import { invite, openPeople } from "./invite-page";

test.use({ storageState: { cookies: [], origins: [] } });
test.setTimeout(120_000);
test.afterEach(clearCompanies);

const rowMenu = (page: Page, name: string) => page.getByRole("region", { name: "People" }).getByRole("button", { name: `More for ${name}` });

test("someone who is already in another company is refused at the invitation, in words", async ({ page, browser }, testInfo) => {
  await signUpOwnerWithStore(page, newEmail(), "One Company Store", "First Co");
  await page.goto("/company");
  await hydrated(page);
  const people = page.getByRole("region", { name: "People" });
  await people.getByRole("button", { name: "Invite" }).click();
  const dialog = page.getByRole("dialog");
  const guestEmail = newEmail();
  await dialog.getByLabel("Email").fill(guestEmail);
  await dialog.getByLabel("Role").selectOption({ label: "Corporate Admin" });
  await dialog.getByRole("button", { name: "Create invite link" }).click();
  const link = await dialog.getByLabel("Invite link").inputValue();
  await dialog.getByRole("button", { name: "Done" }).click();
  // The same rule at a store invitation into one of the company's stores.
  await openPeople(page);
  const storeLink = await invite(page, guestEmail, "Sales Associate");

  const guest = await newGuest(browser, testInfo);
  try {
    await signUpCompanyOnly(guest.page, guestEmail, "Second Co");
    await guest.page.goto(link);
    await expect(guest.page.getByText("You're part of Second Co.", { exact: false })).toBeVisible();
    await expect(guest.page.getByRole("button", { name: "Accept invitation" })).toHaveCount(0);
    await guest.page.goto(storeLink);
    await expect(guest.page.getByText("You're part of Second Co.", { exact: false })).toBeVisible();
  } finally {
    await guest.context.close();
  }
});

test("the owner moves a regional manager to another region, removes them, then hands the company on", async ({ page, browser }, testInfo) => {
  const owner = newEmail();
  await signUpOwnerWithStore(page, owner, "People Store North", "People Co");
  await addRegionAndStore(page, "South", "People Store South");
  const regional = newEmail();
  const corporate = newEmail();
  const rita = await newGuest(browser, testInfo);
  const cora = await newGuest(browser, testInfo);
  try {
    await signUpPlain(rita.page, regional, "Rita Regional");
    await signUpPlain(cora.page, corporate, "Cora Corporate");
    await grantCompanyRole(regional, owner, "regional_manager", "North");
    await grantCompanyRole(corporate, owner, "corporate_admin");

    await page.goto("/company");
    await hydrated(page);
    await rowMenu(page, "Rita Regional").click();
    await page.getByRole("menuitem", { name: "Change region" }).click();
    await page.getByRole("dialog").getByLabel("Region").selectOption({ label: "South" });
    await page.getByRole("dialog").getByRole("button", { name: "Change region" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await rita.page.goto("/company");
    await expect(rita.page.getByText("Regional Manager · South")).toBeVisible();
    await expect(rita.page.getByRole("region", { name: "Stores" }).getByText("People Store South")).toBeVisible();
    await expect(rita.page.getByRole("region", { name: "Stores" }).getByText("People Store North")).toHaveCount(0);

    await page.reload();
    await hydrated(page);
    await rowMenu(page, "Rita Regional").click();
    await page.getByRole("menuitem", { name: "Remove" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Remove", exact: true }).click();
    // An open dialog hides the page from the accessibility tree: wait for it to close before the row can count as gone.
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(rowMenu(page, "Rita Regional")).toHaveCount(0);
    // With no company role and no store, nothing is left to open.
    await rita.page.goto("/home");
    await expect(rita.page).toHaveURL(/\/welcome$/);

    await page.getByRole("button", { name: "Hand off ownership" }).click();
    await page.getByRole("dialog").getByLabel("New owner").selectOption({ label: "Cora Corporate" });
    await page.getByRole("dialog").getByRole("button", { name: "Hand off", exact: true }).click();
    await expect(page.getByText("Cora Corporate is now the owner").first()).toBeVisible();
    await expect(page.locator("#ownership")).toHaveCount(0);
    await cora.page.goto("/company");
    await expect(cora.page.getByRole("region", { name: "Ownership" })).toBeVisible();
  } finally {
    await rita.context.close();
    await cora.context.close();
  }
});
