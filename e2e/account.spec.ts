// Three things that come with roles (0.7.0 task 11): renaming the store, "Keep me signed in",
// and a password change that signs out every other session. All on disposable accounts made
// here (account-store.ts); the shared test accounts are never touched.

import { clearAccounts, newEmail, otherDevice, PASSWORD, signInOnScreen, signUpWithStore } from "./account-store";
import { expect, hydrated, sizeOf, storeTrigger, test } from "./fixtures";

test.use({
  storageState: { cookies: [], origins: [] },
  // A wrong password is logged by the browser as a 401.
  allowedConsoleError: /401|Failed to load resource/,
});
// Sign-up, store creation and a second device make these longer than the default.
test.setTimeout(90_000);

test.afterEach(clearAccounts);

const SESSION_COOKIE = /session_token$/;
const DAY = 86_400;

test("renaming the store shows the new name in the header", async ({ page }, testInfo) => {
  // A phone's header names the store only for someone in more than one (page-header.tsx); this account has one.
  const headerNamesStore = sizeOf(testInfo) !== "phone";
  await signUpWithStore(page, newEmail(), "Rename Me");
  if (headerNamesStore) await expect(storeTrigger(page)).toHaveAttribute("data-store-trigger", "Rename Me");

  await page.goto("/store");
  await hydrated(page);
  await expect(page.getByLabel("Store name")).toHaveValue("Rename Me");
  await page.getByLabel("Store name").fill("Riverside Flagship");
  // Saved on Enter (no Save button, no toast): the indicator beside the field says so.
  await page.getByLabel("Store name").press("Enter");
  // Store name's indicator is the first on the page (the time zone's is the second).
  await expect(page.locator("[data-panel-status]").first()).toHaveText("Saved");

  if (headerNamesStore) await expect(storeTrigger(page)).toHaveAttribute("data-store-trigger", "Riverside Flagship");
  await page.goto("/account");
  await expect(page.locator("#content").getByText("Riverside Flagship")).toBeVisible();
});

test("Keep me signed in decides whether the session cookie outlives the browser", async ({ page, browser }) => {
  const email = newEmail();
  await signUpWithStore(page, email, "Cookie Store");
  // Signing up starts the short session too, like signing in without the box ticked (13b M2).
  expect((await page.context().cookies()).find((c) => SESSION_COOKIE.test(c.name))!.expires).toBe(-1);

  const kept = await otherDevice(browser, page);
  await signInOnScreen(kept.page, email, PASSWORD, true);
  const lasting = (await kept.context.cookies()).find((c) => SESSION_COOKIE.test(c.name))!;
  // Seven days, from now.
  expect(lasting.expires).toBeGreaterThan(Date.now() / 1000 + 6 * DAY);
  expect(lasting.expires).toBeLessThan(Date.now() / 1000 + 8 * DAY);
  await kept.context.close();

  const brief = await otherDevice(browser, page);
  await signInOnScreen(brief.page, email, PASSWORD);
  const cookies = await brief.context.cookies();
  // No expiry at all: it goes when the browser closes.
  expect(cookies.find((c) => SESSION_COOKIE.test(c.name))!.expires).toBe(-1);
  expect(cookies.some((c) => /dont_remember$/.test(c.name))).toBe(true);
  await brief.context.close();
});

test("changing the password signs out the other devices, keeps this one, and the new password works", async ({ page, browser }) => {
  const email = newEmail();
  const NEW = "a-brand-new-passphrase";
  await signUpWithStore(page, email, "Password Store");
  const other = await otherDevice(browser, page);
  await signInOnScreen(other.page, email, PASSWORD);

  await page.goto("/account");
  await hydrated(page);
  // A wrong current password says so beside the field, and changes nothing.
  await page.getByLabel("Current password").fill("not-my-password");
  await page.getByLabel("New password", { exact: true }).fill(NEW);
  await page.getByLabel("Confirm new password").fill(NEW);
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText("That isn't your current password.")).toBeVisible();
  await other.page.goto("/account");
  await expect(other.page.getByRole("heading", { level: 1, name: "Account" })).toBeVisible();

  await page.getByLabel("Current password").fill(PASSWORD);
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText("Password changed. Your other sessions were signed out.", { exact: true })).toBeVisible();

  // This device is still signed in, and still is after a reload (its session cookie was replaced).
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Account" })).toBeVisible();
  await page.goto("/products");
  await expect(page).toHaveURL(/\/products$/);

  // The other device is signed out on its next navigation.
  await other.page.goto("/products");
  await expect(other.page).toHaveURL(/\/sign-in/);
  await other.context.close();

  // The old password no longer works; the new one does.
  const later = await otherDevice(browser, page);
  await later.page.goto("/sign-in");
  await hydrated(later.page);
  await later.page.getByLabel("Work email").fill(email);
  await later.page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await later.page.getByRole("button", { name: "Sign in" }).click();
  await expect(later.page.getByText("That email and password do not match.")).toBeVisible();
  await signInOnScreen(later.page, email, NEW);
  await later.context.close();
});
