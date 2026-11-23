// The two-step screens as a person uses them, for the specs and the setup (0.7.1a, A10): turn it on (the setup
// steps are the same on Account, on /admin/two-factor and on the required-setup page), and sign in with a code.
// The key is read off the setup screen like a person would type it, and answered with e2e/totp.ts.

import type { BrowserContext, Page } from "@playwright/test";

import { expect, hydrated } from "./fixtures";
import { totp } from "./totp";

export type TwoFactorKeys = { secret: string; backupCodes: string[] };

/** The sign-in limit is per address (3 per 10 seconds), so a spec that signs in again takes a new one. */
export async function freshAddress(context: BrowserContext): Promise<void> {
  await context.setExtraHTTPHeaders({ "x-forwarded-for": `10.9.${Number(process.env.TEST_PARALLEL_INDEX ?? 0)}.${1 + Math.floor(Math.random() * 250)}` });
}

/** From the first step ("Turn on two-step sign-in" with a password field) to the end: password, read the key and codes, save, enter a code. */
export async function turnOnOnScreen(page: Page, password: string): Promise<TwoFactorKeys> {
  await hydrated(page);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Continue" }).click();
  const key = page.locator('section[aria-labelledby="setup-key"] code');
  await expect(key).toBeVisible();
  const secret = ((await key.textContent()) ?? "").replace(/\s/g, "");
  const backupCodes = await page.locator('section[aria-labelledby="backup-codes"] li').allTextContents();
  expect(secret).toMatch(/^[A-Z2-7]{16,}$/);
  expect(backupCodes).toHaveLength(10);
  await page.getByLabel("I saved these codes somewhere safe.").check();
  await page.getByLabel("Code from your authenticator app").fill(totp(secret));
  await page.getByRole("button", { name: "Turn on two-step sign-in", exact: true }).click();
  return { secret, backupCodes };
}

/** Password on the sign-in screen, which then asks for a code. `next` is where a sign-in goes afterwards (a path on the site). */
export async function signInToCodePage(page: Page, email: string, password: string, next?: string): Promise<void> {
  await page.goto(next ? `/sign-in?next=${encodeURIComponent(next)}` : "/sign-in");
  await hydrated(page);
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/sign-in/two-factor**");
  await expect(page.getByRole("heading", { name: "Two-step sign-in" })).toBeVisible();
  await hydrated(page);
}

/** The code page: an app code (default) or a backup code, optionally trusting this device, then Verify. */
export async function submitCode(page: Page, code: string, options: { backup?: boolean; trust?: boolean } = {}): Promise<void> {
  if (options.backup) await page.getByRole("button", { name: "Use a backup code instead" }).click();
  await page.getByLabel(options.backup ? "Backup code" : "Code from your authenticator app").fill(code);
  if (options.trust) await page.getByLabel("Trust this device for 30 days").check();
  await page.getByRole("button", { name: "Verify", exact: true }).click();
}

/** Password, then the current app code. Ends wherever the sign-in goes next. */
export async function signInWithCode(page: Page, email: string, password: string, secret: string, next?: string): Promise<void> {
  await signInToCodePage(page, email, password, next);
  await submitCode(page, totp(secret));
}
