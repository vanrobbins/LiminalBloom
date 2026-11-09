// Signs every worker's account in once and saves its session. Creates an
// account the first time, gives it both stores, and ends on the home store.

import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import type { Page } from "@playwright/test";

import { expect, test as setup, storeTrigger, switchStore } from "./fixtures";
import { accountFor, authFileFor, E2E_WORKERS, HOME_STORE, ipFor, SECOND_STORE } from "./test-account";

config({ path: ".env.local", quiet: true });

setup.use({ storageState: { cookies: [], origins: [] } });

async function createStore(page: Page, name: string) {
  await page.goto("/create-store");
  await page.getByLabel("Store name").fill(name);
  await page.getByRole("button", { name: "Create store" }).click();
  await page.waitForURL("**/products");
}

async function signInOrUp(page: Page, worker: number) {
  const account = accountFor(worker);
  await page.goto("/sign-in");
  await page.getByLabel("Work email").fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  const refused = page.getByText("That email and password do not match.");
  await expect(refused.or(page.getByRole("searchbox", { name: "Search products" })).or(page.getByLabel("Store name"))).toBeVisible();
  if (!(await refused.isVisible())) return;

  await page.goto("/sign-up");
  await page.getByLabel("Name").fill(`E2E Worker ${worker}`);
  await page.getByLabel("Work email").fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/(products|create-store)/);
}

setup("sign in every worker's account, each with two stores, in the home store", async ({ browser }) => {
  setup.setTimeout(60_000 * E2E_WORKERS);
  const db = neon(process.env.DATABASE_URL!);
  for (let worker = 0; worker < E2E_WORKERS; worker++) {
    const context = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": ipFor(worker) } });
    const page = await context.newPage();
    await signInOrUp(page, worker);

    const stores = await db`
      select o.name from organization o
      join member m on m.organization_id = o.id
      join "user" u on u.id = m.user_id
      where u.email = ${accountFor(worker).email}`;
    const has = (name: string) => stores.some((store) => store.name === name);
    if (!has(HOME_STORE)) await createStore(page, HOME_STORE);
    if (!has(SECOND_STORE)) await createStore(page, SECOND_STORE);

    await page.goto("/products");
    if ((await storeTrigger(page).getAttribute("data-store-trigger")) !== HOME_STORE) {
      await switchStore(page, HOME_STORE);
    }
    await expect(storeTrigger(page)).toHaveAttribute("data-store-trigger", HOME_STORE);
    await context.storageState({ path: authFileFor(worker) });
    await context.close();
  }
});
