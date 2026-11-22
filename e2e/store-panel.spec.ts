// The Store panel at /store per role (0.7.0.7, spec section 4): the details, the Roles link, Invite and
// the people, each shown by the switches the role holds, and the old /people and /roles URLs. Each role is
// signed in as its own account in the shared role store (auth.setup.ts); nothing here is saved, so
// workers share it. Renaming the store is still proved on a disposable account (account.spec.ts).

import type { Page } from "@playwright/test";

import { everyEmail, expectEveryoneListed, expectRefused, inviteButton, invitationRow, mainNav, mainText, openPeople, rolesLink } from "./access-page";
import { expect, hydrated, test } from "./fixtures";
import { ROLE_STORE } from "./test-account";

const storeTab = (page: Page) => mainNav(page).getByRole("link", { name: "Store" });
const nameField = (page: Page) => page.getByRole("textbox", { name: "Store name" });
const zoneButton = (page: Page) => page.getByRole("button", { name: /^Time zone/ });
const cantChange = (page: Page) => page.getByText("Your role can't change these.");

/** The Store tab is current, and the people and their groups are listed, whatever the role. */
async function expectCommon(page: Page) {
  await openPeople(page);
  await expect(storeTab(page)).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { level: 2, name: "Store details" })).toBeVisible();
  await expectEveryoneListed(page);
}

/** What a role without store.settings reads: the name and time zone as text, one line saying why. */
async function expectReadOnlyDetails(page: Page) {
  await expect(nameField(page)).toHaveCount(0);
  await expect(zoneButton(page)).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Store details" }).getByText(ROLE_STORE)).toBeVisible();
  await expect(cantChange(page)).toHaveCount(1);
}

/** The addresses and the waiting invitation come only to a role with people.manage. */
async function expectAddresses(page: Page, shown: boolean) {
  const text = await mainText(page);
  for (const email of everyEmail()) shown ? expect(text).toContain(email) : expect(text).not.toContain(email);
  if (!shown) expect(text).not.toContain("@");
  await expect(invitationRow(page)).toHaveCount(shown ? 1 : 0);
}

test.describe("Store Manager", () => {
  test.use({ asRole: "store_manager" });

  test("edits the details, sees the Roles link, Invite, every address and the invitation", async ({ page }) => {
    await expectCommon(page);
    await expect(nameField(page)).toHaveValue(ROLE_STORE);
    await expect(zoneButton(page)).toBeVisible();
    await expect(cantChange(page)).toHaveCount(0);
    await expect(rolesLink(page)).toHaveAttribute("href", "/store/roles");
    await expect(inviteButton(page)).toBeVisible();
    await expectAddresses(page, true);
  });
});

test.describe("Assistant Manager", () => {
  test.use({ asRole: "assistant_manager" });

  test("reads the details, and has the Roles link, Invite and every address", async ({ page }) => {
    await expectCommon(page);
    await expectReadOnlyDetails(page);
    await expect(rolesLink(page)).toBeVisible();
    await expect(inviteButton(page)).toBeVisible();
    await expectAddresses(page, true);
  });
});

test.describe("Visual Merchandising Manager", () => {
  test.use({ asRole: "vm_manager" });

  test("reads the details and has Invite and the addresses, but no Roles link", async ({ page }) => {
    await expectCommon(page);
    await expectReadOnlyDetails(page);
    await expect(rolesLink(page)).toHaveCount(0);
    await expect(inviteButton(page)).toBeVisible();
    await expectAddresses(page, true);
  });
});

for (const role of ["vm_worker", "sales_associate"] as const) {
  test.describe(role === "vm_worker" ? "Visual Merchandising Worker" : "Sales Associate", () => {
    test.use({ asRole: role });

    test("reads the details and the names, with no Roles link, no Invite and no address", async ({ page }) => {
      await expectCommon(page);
      await expectReadOnlyDetails(page);
      await expect(rolesLink(page)).toHaveCount(0);
      await expect(inviteButton(page)).toHaveCount(0);
      await expectAddresses(page, false);
    });
  });
}

test.describe("old addresses", () => {
  test.describe("with roles.manage", () => {
    test.use({ asRole: "store_manager" });

    test("/people lands on /store and keeps its query", async ({ page }) => {
      await page.goto("/people");
      await expect(page).toHaveURL(/\/store$/);
      await page.goto("/people?x=1");
      await expect(page).toHaveURL(/\/store\?x=1$/);
    });

    test("/roles lands on /store/roles, which keeps the Store tab current and goes Back to Store", async ({ page }) => {
      await page.goto("/roles");
      await expect(page).toHaveURL(/\/store\/roles$/);
      await hydrated(page);
      await expect(page.getByRole("heading", { level: 1, name: "Roles and permissions" })).toBeVisible();
      await expect(storeTab(page)).toHaveAttribute("aria-current", "page");
      await page.locator("[data-page-header]").getByRole("link", { name: /^(Back to Store|← Store)$/ }).click();
      await expect(page).toHaveURL(/\/store$/);
    });
  });

  test.describe("without roles.manage", () => {
    test.use({ asRole: "vm_manager" });

    test("/roles ends on /no-access, and /people still lands on /store", async ({ page }) => {
      await expectRefused(page, "/roles");
      await page.goto("/people");
      await expect(page).toHaveURL(/\/store$/);
    });
  });
});
