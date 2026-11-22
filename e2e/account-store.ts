// Disposable accounts for the Account specs: changing a password or renaming a store must
// never touch the shared test accounts (their passwords and store names are what every
// other spec signs in with). Each is a real @example.test sign-up through the screens,
// with a store of its own; clearAccounts removes the people and their stores.

import { randomUUID } from "node:crypto";

import type { Browser, Page } from "@playwright/test";

import { hydrated } from "./fixtures";
import { sql } from "./map-store";

export const PASSWORD = "correct-horse-battery";
const worker = Number(process.env.TEST_PARALLEL_INDEX ?? 0);
const PREFIX = `e2e_acct_${worker}_`;

export const newEmail = () => `${PREFIX}${randomUUID().slice(0, 8)}@example.test`;

/** Removes every account made here and the stores they belonged to. */
export async function clearAccounts(): Promise<void> {
  const db = sql();
  const mine = `${PREFIX}%@example.test`;
  await db`delete from organization where id in (select m.organization_id from member m join "user" u on u.id = m.user_id where u.email like ${mine})`;
  await db`delete from "user" where email like ${mine}`;
}

/** A browser with nobody signed in, the size of this test's page, as if on another device. Its own address: Better Auth allows 3 sign-ins per address per 10 seconds, and one test signs in several times. */
export async function otherDevice(browser: Browser, page: Page) {
  const context = await browser.newContext({ viewport: page.viewportSize()!, storageState: { cookies: [], origins: [] }, extraHTTPHeaders: { "x-forwarded-for": `10.9.${worker}.${1 + Math.floor(Math.random() * 250)}` } });
  return { context, page: await context.newPage() };
}

/** Creates the account on the sign-up screen, then a store, and waits on Products. */
export async function signUpWithStore(page: Page, email: string, storeName: string) {
  await page.goto("/sign-up");
  await hydrated(page);
  await page.getByLabel("Name").fill("Acct Tester");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/(home|welcome)/);
  await page.goto("/create-store");
  await page.getByLabel("Store name").fill(storeName);
  await page.getByRole("button", { name: "Create store" }).click();
  await page.waitForURL("**/home");
}

/** Signs in on the sign-in screen and waits on Home. `keep` ticks Keep me signed in. */
export async function signInOnScreen(page: Page, email: string, password: string, keep = false) {
  await page.goto("/sign-in");
  await hydrated(page);
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  if (keep) await page.getByLabel("Keep me signed in").check();
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/home");
}
