// Liminal Bloom admins for the specs (0.7.1a, A10). Nothing here is a switch in the app: the guard reads the
// database on every request and wants a fresh code.
//
// The shared admin (`ADMIN`) is made once per run in auth.setup.ts: a new account, flagged an admin in the
// development database (the one step the app leaves to Van's script), then two-step sign-in turned on through
// the screens. Its authenticator key and backup codes are kept for the run in playwright/.auth (git-ignored,
// never in the repo). `adminContext` gives a spec its own browser signed in as that admin the way a person
// does it, password then a code from e2e/totp.ts, so each gets a session of its own (a spec that signs out
// or ages its session cannot reach another's). Specs about two-factor itself use `newAdminAccount`: an admin
// of their own, with no two-factor yet, so they can set it up, age its session or get its codes wrong.

import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import type { Browser, BrowserContext, Page, TestInfo } from "@playwright/test";

import { PASSWORD } from "./account-store";
import { hydrated } from "./fixtures";
import { sql } from "./map-store";
import { freshAddress, signInWithCode, turnOnOnScreen, type TwoFactorKeys } from "./two-factor-screens";

export const ADMIN = { email: "e2e.admin@example.com", password: PASSWORD, name: "Ada Admin" };
const KEYS_FILE = "playwright/.auth/admin-two-factor.json";
const worker = () => Number(process.env.TEST_PARALLEL_INDEX ?? 0);
const PREFIX = "e2e_admin_";

/** Removes every disposable admin account `newAdminAccount` made (the cascade takes the admin row and sessions with it). */
export async function clearAdmins(): Promise<void> {
  await sql()`delete from "user" where email like ${`${PREFIX}%@example.test`}`;
}

/** A new browser the size of this project (phone, tablet or desktop), at an address of its own: sign-ups and sign-ins are limited per address. */
async function sizedContext(browser: Browser, testInfo: TestInfo): Promise<BrowserContext> {
  const { viewport, hasTouch, isMobile, colorScheme, baseURL } = testInfo.project.use;
  const context = await browser.newContext({ viewport, hasTouch, isMobile, colorScheme, baseURL });
  await freshAddress(context);
  return context;
}

async function signUp(page: Page, email: string, name: string) {
  await page.goto("/sign-up");
  await hydrated(page);
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/(home|welcome)/);
}

const makeAdmin = (email: string) => sql()`insert into platform_admins (user_id, added_by_name) select id, 'e2e' from "user" where email = ${email} on conflict do nothing`;

/** A new account that is an admin and has no two-step sign-in yet, signed in (a session with no code), in a browser of this project's size. */
export async function newAdminAccount(browser: Browser, testInfo: TestInfo): Promise<{ context: BrowserContext; page: Page; email: string; password: string }> {
  const context = await sizedContext(browser, testInfo);
  const page = await context.newPage();
  const email = `${PREFIX}${worker()}_${randomUUID().slice(0, 8)}@example.test`;
  await signUp(page, email, "Ada Admin");
  await makeAdmin(email);
  return { context, page, email, password: PASSWORD };
}

/** Auth setup, once per run: makes the shared admin, turns two-step sign-in on through the screens, keeps the key and codes. */
export async function prepareAdmin(browser: Browser): Promise<void> {
  await sql()`delete from "user" where email = ${ADMIN.email}`;
  const context = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": "10.8.1.1" } });
  const page = await context.newPage();
  await signUp(page, ADMIN.email, ADMIN.name);
  await makeAdmin(ADMIN.email);
  await page.goto("/admin/two-factor");
  const keys = await turnOnOnScreen(page, ADMIN.password);
  await page.waitForURL("**/admin");
  mkdirSync("playwright/.auth", { recursive: true });
  writeFileSync(KEYS_FILE, JSON.stringify(keys));
  await context.close();
}

export const adminKeys = (): TwoFactorKeys => JSON.parse(readFileSync(KEYS_FILE, "utf8"));

/** A browser the size of this project, signed in as the shared admin with a code entered a moment ago, on /admin. */
export async function adminContext(browser: Browser, testInfo: TestInfo): Promise<{ context: BrowserContext; page: Page; email: string }> {
  const context = await sizedContext(browser, testInfo);
  const page = await context.newPage();
  await signInWithCode(page, ADMIN.email, ADMIN.password, adminKeys().secret, "/admin");
  await page.waitForURL("**/admin");
  return { context, page, email: ADMIN.email };
}

/** Makes every session of this account's last code `hours` old, as if it had been entered then (the 12-hour rule, lib/admin/freshness.ts). */
export async function ageTwoFactor(email: string, hours: number): Promise<void> {
  await sql()`update session set two_factor_at = now() - ${hours} * interval '1 hour' where user_id = (select id from "user" where email = ${email})`;
}

/** A new admin with two-step sign-in turned on through the screens, signed in with the code it was set up with. */
export async function adminWithTwoFactor(browser: Browser, testInfo: TestInfo) {
  const admin = await newAdminAccount(browser, testInfo);
  await admin.page.goto("/admin/two-factor");
  const keys = await turnOnOnScreen(admin.page, admin.password);
  await admin.page.waitForURL("**/admin");
  return { ...admin, ...keys };
}
