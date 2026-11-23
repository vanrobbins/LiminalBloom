// Passkeys (0.7.1a, A3c) with a Chromium virtual authenticator (CDP WebAuthn.addVirtualAuthenticator), so no real
// key or prompt is needed: add one on Account (named, with the password), sign out, sign in with it, and see that
// the session it made passed a second factor. Desktop Chromium only: the virtual authenticator is the same on every
// size, and WebAuthn over CDP is a Chromium feature. Disposable accounts (account-store.ts).

import type { BrowserContext, Page } from "@playwright/test";

import { clearAccounts, newEmail, PASSWORD, signUpWithStore } from "./account-store";
import { expect, hydrated, sizeOf, test } from "./fixtures";
import { sql } from "./map-store";

test.use({
  storageState: { cookies: [], origins: [] },
  // A wrong password is logged by the browser as a 401/403.
  allowedConsoleError: /40[13]|Failed to load resource/,
});
test.setTimeout(90_000);
test.afterEach(clearAccounts);
test.beforeEach(({}, testInfo) => test.skip(sizeOf(testInfo) !== "desktop", "one size is enough: the authenticator is virtual"));

/** A software authenticator that holds resident keys and says yes to every touch and user verification. */
async function addVirtualAuthenticator(context: BrowserContext, page: Page) {
  const client = await context.newCDPSession(page);
  await client.send("WebAuthn.enable");
  await client.send("WebAuthn.addVirtualAuthenticator", {
    options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });
}

async function addPasskey(page: Page, name: string, password = PASSWORD) {
  await page.goto("/account");
  await hydrated(page);
  await page.getByRole("button", { name: /^Add (a|another) passkey$/ }).click();
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Add passkey" }).click();
}

const passkeysCard = (page: Page) => page.locator("#passkeys");

test("add a passkey on Account, sign out, and sign in with it", async ({ page, context }) => {
  const email = newEmail();
  await addVirtualAuthenticator(context, page);
  await signUpWithStore(page, email, "Passkey Store");

  await addPasskey(page, "Test key");
  await expect(passkeysCard(page).getByText("Test key")).toBeVisible();
  await expect(passkeysCard(page).getByText(/Not used yet/)).toBeVisible();
  // With a passkey the account has a second step, with no authenticator app.
  await expect(page.getByText(/Your passkey counts as your second step/)).toBeVisible();

  // Signed out: the session cookie is gone, the key stays in the (virtual) authenticator.
  await context.clearCookies();
  await page.goto("/sign-in");
  await hydrated(page);
  await page.getByRole("button", { name: "Sign in with a passkey" }).click();
  await page.waitForURL("**/home");

  // The session the passkey made passed a second factor (the session hook), and Account shows it was used.
  const [row] = await sql()`select s.two_factor_at from session s join "user" u on u.id = s.user_id where u.email = ${email} order by s.created_at desc limit 1`;
  expect(row.two_factor_at).not.toBeNull();
  await page.goto("/account");
  await expect(passkeysCard(page).getByText(/Last used/)).toBeVisible();
});

test("a wrong password adds nothing, rename works, and removing needs the password", async ({ page, context }) => {
  await addVirtualAuthenticator(context, page);
  await signUpWithStore(page, newEmail(), "Passkey Edit Store");

  await addPasskey(page, "First", "not-my-password");
  await expect(page.getByText("That isn't your password.")).toBeVisible();
  await expect(passkeysCard(page).getByText(/None yet/)).toBeVisible();

  await addPasskey(page, "First");
  await expect(passkeysCard(page).getByText("First")).toBeVisible();

  await page.getByRole("button", { name: "Rename First" }).click();
  await page.getByLabel("Name").fill("Work laptop");
  await page.getByRole("button", { name: "Save name" }).click();
  await expect(passkeysCard(page).getByText("Work laptop")).toBeVisible();

  await page.getByRole("button", { name: "Remove Work laptop" }).click();
  await page.getByLabel(/Password, to remove/).fill("not-my-password");
  await page.getByRole("button", { name: "Remove passkey" }).click();
  await expect(page.getByText("That isn't your password.")).toBeVisible();
  await page.getByLabel(/Password, to remove/).fill(PASSWORD);
  await page.getByRole("button", { name: "Remove passkey" }).click();
  await expect(passkeysCard(page).getByText(/None yet/)).toBeVisible();
});
