// The admin help actions end to end (0.7.1a, A5 and A6), at desktop: the shared dialog needs a reason, each action
// changes what the other person sees in their own browser, and the admins page adds and removes. The admin is
// made by admin-account.ts; the person helped is a disposable account in a browser of its own, with a store of
// its own. Phone and tablet open the same pages (admin.spec.ts), so the flows run once.

import { randomUUID } from "node:crypto";

import type { BrowserContext, Page } from "@playwright/test";

import { adminContext, clearAdmins } from "./admin-account";
import { clearAccounts, newEmail, otherDevice, PASSWORD, signInOnScreen, signUpWithStore } from "./account-store";
import { builtinOf, clearActionData, invitationStatus, isAdmin, REASON, seedPendingInvitation, seedTwoFactor, seedWorker, storeOf, twoFactorRows } from "./admin-actions-store";
import { expect, hydrated, sizeOf, test } from "./fixtures";

test.describe("admin help actions", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(90_000);

  let admin: Page;
  let adminEmail: string;
  let helped: { context: BrowserContext; page: Page };
  let store: string;
  let worker: string;
  const email = newEmail();
  const storeName = `Help ${randomUUID().slice(0, 6)}`;
  const reason = (what: string) => `${REASON} ${what}`;

  test.beforeAll(async ({ browser }, testInfo) => {
    test.skip(sizeOf(testInfo) !== "desktop", "the flows run once, at desktop");
    ({ page: admin, email: adminEmail } = await adminContext(browser, testInfo));
    helped = await otherDevice(browser, admin);
    await signUpWithStore(helped.page, email, storeName);
    store = await storeOf(email);
    worker = await seedWorker(store, "Sam Sales");
  });
  test.afterAll(async () => {
    await admin?.context().close();
    await helped?.context.close();
    await clearAdmins();
    await clearAccounts();
    await clearActionData();
  });
  test.beforeEach(({}, testInfo) => test.skip(sizeOf(testInfo) !== "desktop", "the flows run once, at desktop"));

  /** Opens an action's dialog, shows that it will not go without a reason, then confirms with one. */
  async function act(page: Page, button: string, confirm: string, why: string) {
    await page.getByRole("button", { name: button, exact: true }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: confirm, exact: true })).toBeDisabled();
    await dialog.getByLabel("Reason").fill(reason(why));
    await dialog.getByRole("button", { name: confirm, exact: true }).click();
    await expect(dialog).toBeHidden();
  }

  test("Sign out everywhere ends the person's session in their own browser", async () => {
    await helped.page.goto("/home");
    await admin.goto(`/admin/people?email=${encodeURIComponent(email)}`);
    await hydrated(admin);
    await act(admin, "Sign out everywhere", "Sign out everywhere", "sign out");
    await expect(admin.getByText("Signed out everywhere.", { exact: true })).toBeVisible();
    await helped.page.goto("/home");
    await expect(helped.page).toHaveURL(/\/sign-in/);
  });

  test("Pause sends the store's only person to /paused and Restore brings the store back", async () => {
    await signInOnScreen(helped.page, email, PASSWORD);
    await admin.goto(`/admin/stores/${store}`);
    await hydrated(admin);
    await act(admin, "Pause", "Pause store", "pause");
    await expect(admin.getByText("Store paused.", { exact: true })).toBeVisible();
    await expect(admin.getByRole("button", { name: "Restore", exact: true })).toBeVisible();
    await expect(admin.locator("#content").getByText("Paused", { exact: true }).first()).toBeVisible();

    await helped.page.goto("/home");
    await expect(helped.page).toHaveURL(/\/paused$/);
    await expect(helped.page.getByRole("heading", { level: 1, name: "Your store is paused" })).toBeVisible();
    await expect(helped.page.getByText(`${storeName} is paused by Liminal Bloom. Nothing has been deleted.`)).toBeVisible();

    await act(admin, "Restore", "Restore store", "restore");
    await expect(admin.getByText("Store restored.", { exact: true })).toBeVisible();
    await helped.page.goto("/home");
    await expect(helped.page).toHaveURL(/\/home$/);
  });

  test("Make Store Manager and Cancel invitation change the store, and each row goes", async () => {
    const invitation = await seedPendingInvitation(store, `e2e_adminact_${randomUUID().slice(0, 6)}@example.test`);
    await admin.goto(`/admin/stores/${store}`);
    await hydrated(admin);
    const sam = admin.getByRole("listitem").filter({ hasText: "Sam Sales" });
    await sam.getByRole("button", { name: "Make Store Manager" }).click();
    const dialog = admin.getByRole("dialog");
    await dialog.getByLabel("Reason").fill(reason("manager"));
    await dialog.getByRole("button", { name: "Make Store Manager" }).click();
    await expect(dialog).toBeHidden();
    await expect(sam.getByRole("button", { name: "Make Store Manager" })).toHaveCount(0);
    expect(await builtinOf(worker, store)).toBe("store_manager");

    await act(admin, "Cancel invitation", "Cancel invitation", "cancel");
    await expect(admin.getByRole("button", { name: "Cancel invitation" })).toHaveCount(0);
    expect(await invitationStatus(invitation)).toBe("canceled");
  });

  test("Reset two-step sign-in clears an ordinary account, and an admin's card has no Reset", async () => {
    await seedTwoFactor(email);
    await admin.goto(`/admin/people?email=${encodeURIComponent(email)}`);
    await hydrated(admin);
    await expect(admin.getByText("On: Authenticator app")).toBeVisible();
    await act(admin, "Reset two-step sign-in", "Reset two-step sign-in", "reset");
    await expect(admin.getByText("Off", { exact: true })).toBeVisible();
    expect(await twoFactorRows(email)).toBe(0);

    await admin.goto(`/admin/people?email=${encodeURIComponent(adminEmail)}`);
    await expect(admin.locator("#content").getByText("Liminal Bloom admin", { exact: true })).toBeVisible();
    await expect(admin.getByRole("button", { name: "Reset two-step sign-in" })).toHaveCount(0);
  });

  test("Admins adds an account by email, refuses one with no account, and removes the admin again", async () => {
    await admin.goto("/admin/admins");
    await hydrated(admin);
    await admin.getByLabel("Email").fill("nobody-has-this@example.test");
    await admin.getByRole("button", { name: "Add admin", exact: true }).click();
    const dialog = admin.getByRole("dialog");
    await dialog.getByLabel("Reason").fill(reason("no account"));
    await dialog.getByRole("button", { name: "Add admin", exact: true }).click();
    await expect(dialog.getByRole("status")).toHaveText("No account has that email. They need to sign up first.");
    await admin.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    await admin.getByLabel("Email").fill(email.toUpperCase());
    await act(admin, "Add admin", "Add admin", "add");
    const row = admin.getByRole("listitem").filter({ hasText: email });
    await expect(row).toBeVisible();
    expect(await isAdmin(email)).toBe(true);

    await row.getByRole("button", { name: "Remove" }).click();
    const removal = admin.getByRole("dialog");
    await removal.getByLabel("Reason").fill(reason("remove"));
    await removal.getByRole("button", { name: "Remove admin" }).click();
    // Behind an open dialog the page is hidden from the accessibility tree, so wait for it to close first.
    await expect(removal).toBeHidden();
    await expect(row).toHaveCount(0);
    expect(await isAdmin(email)).toBe(false);
  });

  test("Activity lists what was done, with each reason", async () => {
    await admin.goto("/admin/activity");
    for (const label of ["Signed out everywhere", "Store paused", "Store restored", "Store Manager made", "Invitation canceled", "Two-step sign-in reset", "Admin added", "Admin removed"]) {
      await expect(admin.locator("#content").getByText(label, { exact: true }).filter({ visible: true }).first()).toBeVisible();
    }
    await expect(admin.locator("#content").getByText(reason("pause")).filter({ visible: true }).first()).toBeVisible();
  });
});
