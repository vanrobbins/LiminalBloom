// Two-step sign-in for everyone (0.7.1a, A3b / A10): an account opts in on Account, signs in with a code, a
// trusted device skips the code, a role that requires two-factor sends its people to set it up, and a Liminal
// Bloom admin resets it for an ordinary account. Disposable accounts with a store of their own (account-store.ts);
// the store's roles start with the requirement off (relax-two-factor.ts), as for every other spec.

import type { Page } from "@playwright/test";

import { adminContext } from "./admin-account";
import { clearActionData, REASON } from "./admin-actions-store";
import { clearAccounts, newEmail, PASSWORD, signUpWithStore } from "./account-store";
import { expect, hydrated, test } from "./fixtures";
import { requireTwoFactor } from "./relax-two-factor";
import { freshAddress, signInToCodePage, submitCode, turnOnOnScreen } from "./two-factor-screens";
import { totp, wrongCode } from "./totp";

test.use({ storageState: { cookies: [], origins: [] }, allowedConsoleError: /40[0-9]|Failed to load resource/ });
test.setTimeout(90_000);
test.afterEach(async () => {
  await clearAccounts();
  await clearActionData();
});

/** A new account with a store, two-step sign-in turned on from Account. */
async function accountWithTwoFactor(page: Page, store: string) {
  const email = newEmail();
  await signUpWithStore(page, email, store);
  await page.goto("/account");
  await hydrated(page);
  await expect(page.locator("#two-factor").getByText(/^Off\./)).toBeVisible();
  await page.locator("#two-factor").getByRole("button", { name: "Turn on" }).click();
  const keys = await turnOnOnScreen(page, PASSWORD);
  await expect(page.locator("#two-factor").getByText(/^On\. Signing in asks for a code/)).toBeVisible();
  return { email, ...keys };
}

/** Signing out: the session cookies go (the trusted-device one stays unless `all`), and the next sign-in comes from a new address. */
async function signOut(page: Page, all = true) {
  await page.context().clearCookies(all ? undefined : { name: /session/ });
  await freshAddress(page.context());
}

test("opting in on Account turns it on, and the next sign-in asks for the code", async ({ page }) => {
  const { email, secret, backupCodes } = await accountWithTwoFactor(page, "Two Factor Store");
  await expect(page.locator("#two-factor").getByText("10 backup codes left.")).toBeVisible();
  expect(backupCodes).toHaveLength(10);

  await signOut(page);
  await signInToCodePage(page, email, PASSWORD);
  await submitCode(page, wrongCode(secret));
  await expect(page.locator('p[role="alert"]')).toHaveText("That code didn't work. Try the newest one.");
  await submitCode(page, totp(secret));
  await page.waitForURL("**/home");
});

test("Trust this device skips the code at the next password sign-in, and a sign-in without it still asks", async ({ page }) => {
  const { email, secret } = await accountWithTwoFactor(page, "Trusted Store");

  await signOut(page);
  await signInToCodePage(page, email, PASSWORD);
  await submitCode(page, totp(secret), { trust: true });
  await page.waitForURL("**/home");

  // Signed out, but the browser keeps its trusted-device cookie: the password is enough.
  await signOut(page, false);
  await page.goto("/sign-in");
  await hydrated(page);
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/home");

  // Another browser, with no such cookie, is asked.
  await signOut(page);
  await signInToCodePage(page, email, PASSWORD);
});

test("a role that requires two-factor sends its people to Account to set it up, and Home opens once it is on", async ({ page }) => {
  const email = newEmail();
  await signUpWithStore(page, email, "Required Store");
  await page.goto("/home");
  await expect(page.getByRole("searchbox", { name: "Search products" })).toBeVisible();

  await requireTwoFactor([email]);
  for (const path of ["/home", "/products", "/store"]) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/account$/);
  }
  await expect(page.getByText("Your role, Store Manager, needs two-step sign-in. Turn it on to carry on.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();

  await turnOnOnScreen(page, PASSWORD);
  await page.waitForURL("**/home");
  await expect(page.getByRole("searchbox", { name: "Search products" })).toBeVisible();
  await page.goto("/products");
  await expect(page).toHaveURL(/\/products$/);
});

test("an admin resets an ordinary account's two-step sign-in, and its next sign-in needs the password only", async ({ page, browser }, testInfo) => {
  const { email } = await accountWithTwoFactor(page, "Reset Store");
  await signOut(page);

  const admin = await adminContext(browser, testInfo);
  try {
    await admin.page.goto(`/admin/people?email=${encodeURIComponent(email)}`);
    await hydrated(admin.page);
    await expect(admin.page.getByText("On: Authenticator app")).toBeVisible();
    await admin.page.getByRole("button", { name: "Reset two-step sign-in", exact: true }).click();
    const dialog = admin.page.getByRole("dialog");
    await dialog.getByLabel("Reason").fill(`${REASON} two-factor spec`);
    await dialog.getByRole("button", { name: "Reset two-step sign-in", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(admin.page.getByText("Off", { exact: true })).toBeVisible();
  } finally {
    await admin.context.close();
  }

  await page.goto("/sign-in");
  await hydrated(page);
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/home");
});
