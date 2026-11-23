// Company actions of a Liminal Bloom admin, through the screens (0.7.1b, B11; B10): Pause lands the company's
// people on /paused, which names it; Restore brings them back; Hand ownership to a corporate admin; Cancel a
// company invitation. The admin is the shared one (admin-account.ts); the company's people are disposable
// accounts, each in a browser of its own. The admin's log rows carry REASON so clearActionData removes them.

import { randomUUID } from "node:crypto";

import type { Page } from "@playwright/test";

import { adminContext } from "./admin-account";
import { clearActionData, REASON } from "./admin-actions-store";
import { clearCompanies, grantCompanyRole, newEmail, newGuest, signUpCompanyOnly, signUpOwnerWithStore, signUpPlain } from "./company-store";
import { expect, hydrated, test } from "./fixtures";
import { sql } from "./map-store";

test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

let admin: Page;
test.beforeAll(async ({ browser }, testInfo) => {
  ({ page: admin } = await adminContext(browser, testInfo));
});
test.afterAll(async () => {
  await admin?.context().close();
});
test.afterEach(async () => {
  await clearCompanies();
  await clearActionData();
});

const companyName = () => `Admin Co ${randomUUID().slice(0, 6)}`;

/** The admin opens the company's page. */
async function openCompany(name: string) {
  await admin.goto("/admin/companies");
  await hydrated(admin);
  await admin.getByRole("link", { name: new RegExp(name) }).first().click();
  await expect(admin.getByRole("heading", { level: 1, name })).toBeVisible();
  await hydrated(admin);
}

/** A button on the company's page, its dialog's Reason, and the dialog's confirm. */
async function act(button: string, confirm: string) {
  await admin.getByRole("button", { name: button, exact: true }).click();
  const dialog = admin.getByRole("dialog");
  const reason = dialog.getByLabel("Reason");
  await reason.fill(`${REASON} ${button}`);
  await dialog.getByRole("button", { name: confirm, exact: true }).click();
  await expect(dialog).toHaveCount(0);
}

test("pausing a company puts its people on /paused, which names it; restoring brings them back", async ({ page }) => {
  const name = companyName();
  await signUpCompanyOnly(page, newEmail(), name);
  await page.goto("/company");
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();

  await openCompany(name);
  await act("Pause", "Pause company");
  await expect(admin.getByText("Paused", { exact: true }).first()).toBeVisible();
  await page.goto("/company");
  await page.waitForURL("**/paused");
  await expect(page.getByRole("heading", { level: 1, name: `${name} is paused` })).toBeVisible();

  await openCompany(name);
  await act("Restore", "Restore company");
  await page.goto("/company");
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
});

test("an admin hands ownership to a corporate admin, who then holds Ownership; and cancels an invitation", async ({ page, browser }, testInfo) => {
  const name = companyName();
  const owner = newEmail();
  const adminEmail = newEmail();
  await signUpOwnerWithStore(page, owner, `Admin Store ${randomUUID().slice(0, 4)}`, name);
  const guest = await newGuest(browser, testInfo);
  try {
    await signUpPlain(guest.page, adminEmail, "Corp Admin");
    await grantCompanyRole(adminEmail, owner, "corporate_admin");
    await sql()`insert into company_invitations (id, company_id, email, role, expires_at) select ${randomUUID()}, c.id, 'e2e-waiting@example.test', 'corporate_admin', now() + interval '2 days' from companies c where c.name = ${name}`;

    await openCompany(name);
    await expect(admin.getByText("e2e-waiting@example.test")).toBeVisible();
    await act("Cancel invitation", "Cancel invitation");
    await expect(admin.getByText("e2e-waiting@example.test")).toHaveCount(0);
    await act("Hand ownership to Corp Admin", "Hand off");

    // The new owner holds Ownership; the old owner stays a corporate admin: People, no Ownership.
    await guest.page.goto("/company");
    await expect(guest.page.getByRole("region", { name: "Ownership" })).toBeVisible();
    await page.goto("/company");
    await expect(page.getByRole("region", { name: "People" })).toBeVisible();
    await expect(page.locator("#ownership")).toHaveCount(0);
  } finally {
    await guest.context.close();
  }
});
