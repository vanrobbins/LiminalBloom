// A Liminal Bloom admin for the specs that open /admin. TEMPORARY, from 0.7.1a task A4: it makes the account
// an admin straight in the development database (platform_admins, two_factor_enabled, a fresh two_factor_at on
// its session), so the page-open specs do not need the two-factor screens. A10 replaces this with the real
// flow (the admin account made in auth.setup.ts, two-factor set up once through the screens with a TOTP code
// from e2e/totp.ts) and keeps `adminContext`'s signature if it can. Nothing here is a switch in the app: the
// guard still reads the database on every request, and a session without a fresh `two_factor_at` is sent away.

import { randomUUID } from "node:crypto";

import type { Browser, BrowserContext, Page, TestInfo } from "@playwright/test";

import { hydrated } from "./fixtures";
import { sql } from "./map-store";

const PASSWORD = "correct-horse-battery";
const worker = () => Number(process.env.TEST_PARALLEL_INDEX ?? 0);
const PREFIX = "e2e_admin_";

/** Removes every admin account this helper made (the cascade takes the admin row and sessions with it). */
export async function clearAdmins(): Promise<void> {
  await sql()`delete from "user" where email like ${`${PREFIX}%@example.test`}`;
}

/**
 * A browser context the size of this project (phone, tablet or desktop), signed in as a new account that is an admin
 * with a code entered a moment ago. Sign-up goes through the screen, so the session is a real one.
 */
export async function adminContext(browser: Browser, testInfo: TestInfo): Promise<{ context: BrowserContext; page: Page; email: string }> {
  const { viewport, hasTouch, isMobile, colorScheme } = testInfo.project.use;
  const context = await browser.newContext({
    viewport,
    hasTouch,
    isMobile,
    colorScheme,
    // Its own address: sign-ups and sign-ins are limited per address (see account-store.ts).
    extraHTTPHeaders: { "x-forwarded-for": `10.9.${worker()}.${1 + Math.floor(Math.random() * 250)}` },
    baseURL: testInfo.project.use.baseURL,
  });
  const page = await context.newPage();
  const email = `${PREFIX}${worker()}_${randomUUID().slice(0, 8)}@example.test`;
  await page.goto("/sign-up");
  await hydrated(page);
  await page.getByLabel("Name").fill("Ada Admin");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/(home|welcome)/);

  const db = sql();
  await db`insert into platform_admins (user_id, added_by_name) select id, 'e2e' from "user" where email = ${email}`;
  await db`update "user" set two_factor_enabled = true where email = ${email}`;
  await db`update session set two_factor_at = now() where user_id = (select id from "user" where email = ${email})`;
  return { context, page, email };
}
