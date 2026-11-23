// Asking for a company and the admin's decision, through the screens (0.7.1b, B11; spec 15, B5): send from
// /welcome, withdraw, approve (the new owner lands on /company), reject with a reason and the Ask button, and an
// owner's request that cannot be approved yet. The admin is the shared one (admin-account.ts), in a browser of
// its own; the requester is a disposable account. Their log rows carry REASON so clearActionData removes them.

import { randomUUID } from "node:crypto";

import type { Page } from "@playwright/test";

import { adminContext } from "./admin-account";
import { clearActionData, REASON } from "./admin-actions-store";
import { addRegionAndStore, approveByDb, clearCompanies, newEmail, signUpPlain } from "./company-store";
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

const companyName = () => `Req Co ${randomUUID().slice(0, 6)}`;

/** The requester asks on /request-company and waits for the card. */
async function ask(page: Page, name: string) {
  await page.goto("/request-company");
  await hydrated(page);
  await page.getByLabel("Company name").fill(name);
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByText(`Your request for ${name} is waiting for Liminal Bloom.`)).toBeVisible();
}

/** The admin opens the waiting request and takes an action with a reason. */
async function decide(name: string, action: "Approve" | "Reject") {
  await admin.goto("/admin/requests");
  await hydrated(admin);
  await admin.getByRole("link", { name: new RegExp(name) }).click();
  await expect(admin.getByRole("heading", { level: 1, name })).toBeVisible();
  await hydrated(admin);
  await admin.getByRole("button", { name: action, exact: true }).click();
  const dialog = admin.getByRole("dialog");
  await dialog.getByLabel("Reason").fill(`${REASON} ${action.toLowerCase()} ${name}`);
  await dialog.getByRole("button", { name: action, exact: true }).click();
  await expect(dialog).toHaveCount(0);
}

test("sent from /welcome, approved by an admin: the new owner lands on /company and builds on it", async ({ page }) => {
  const name = companyName();
  await signUpPlain(page, newEmail());
  await page.waitForURL("**/welcome");
  await page.getByRole("link", { name: "Request a company" }).click();
  await page.waitForURL("**/request-company");
  await ask(page, name);
  // The welcome page shows the same card while it waits.
  await page.goto("/welcome");
  await expect(page.getByRole("heading", { name: "Company request" })).toBeVisible();

  await decide(name, "Approve");
  // Every company role asks for two-factor; the e2e account is flagged as company-store.ts does.
  await sql()`update "user" set two_factor_enabled = true where id = (select requester_id from company_requests where company_name = ${name})`;
  await page.goto("/welcome");
  await page.waitForURL("**/company");
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await addRegionAndStore(page, "West", "Approved Store");
  await expect(page.getByText("Approved Store").first()).toBeAttached();
});

test("a waiting request is withdrawn, and the form comes back", async ({ page }) => {
  const name = companyName();
  await signUpPlain(page, newEmail());
  await ask(page, name);
  await page.getByRole("button", { name: "Withdraw", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Withdraw request" }).click();
  await expect(page.getByRole("button", { name: "Send request" })).toBeVisible();
  await expect(page.getByText(`Your request for ${name}`)).toHaveCount(0);
});

test("a rejection shows its reason and offers Ask Liminal Bloom; the person can ask again", async ({ page }) => {
  const name = companyName();
  await signUpPlain(page, newEmail());
  await ask(page, name);
  await decide(name, "Reject");
  await page.reload();
  await expect(page.getByText(`Liminal Bloom didn't approve ${name}: ${REASON} reject ${name}`)).toBeVisible();
  await expect(page.getByRole("link", { name: "Ask Liminal Bloom" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Send request" })).toBeVisible();
});

test("an owner's request waits for the hand-off: the admin sees why and is not offered Approve", async ({ page }) => {
  const name = companyName();
  const email = newEmail();
  await signUpPlain(page, email);
  await approveByDb(email, companyName());
  await sql()`insert into company_requests (requester_id, company_name) select id, ${name} from "user" where email = ${email}`;
  await admin.goto("/admin/requests");
  await hydrated(admin);
  await admin.getByRole("link", { name: new RegExp(name) }).click();
  await expect(admin.getByRole("heading", { level: 1, name })).toBeVisible();
  await expect(admin.getByText(/Waiting on .* to hand off /)).toBeVisible();
  await expect(admin.getByRole("button", { name: "Approve", exact: true })).toHaveCount(0);
  await expect(admin.getByRole("button", { name: "Reject", exact: true })).toBeVisible();
});
