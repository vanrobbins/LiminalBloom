// Signs every worker's account in once and saves its session. Creates an
// account the first time, gives it both stores, and ends on the home store.

import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import type { Page } from "@playwright/test";

import { expect, test as setup, currentStore, switchStore } from "./fixtures";
import { placeRoleAccount, roleStoreId, seedRoleStore } from "./role-store";
import { relaxTwoFactor } from "./relax-two-factor";
import { accountFor, authFileFor, E2E_WORKERS, HOME_STORE, ipFor, ROLE_KEYS, ROLE_STORE, roleAccount, roleAuthFile, roleIp, SECOND_STORE } from "./test-account";

config({ path: ".env.local", quiet: true });

setup.use({ storageState: { cookies: [], origins: [] } });

async function createStore(page: Page, name: string, email: string) {
  await page.goto("/create-store");
  await page.getByLabel("Store name").fill(name);
  await page.getByRole("button", { name: "Create store" }).click();
  // A new Store Manager is sent to Account until two-factor is on (the role requires it by default): turn that off for this
  // store, as the owner, then carry on to Home. relax-two-factor.ts says why.
  await page.waitForURL(/\/(home|account)$/);
  await relaxTwoFactor([email]);
  await page.goto("/home");
  await page.waitForURL("**/home");
}

async function signInOrUp(page: Page, account: { email: string; password: string }, name: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Work email").fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  // Ticked so the saved session is a lasting cookie, as it was before the box existed.
  await page.getByLabel("Keep me signed in").check();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const refused = page.getByText("That email and password do not match.");
  await expect(refused.or(page.getByRole("searchbox", { name: "Search products" })).or(page.getByLabel("Store name")).or(page.getByRole("heading", { name: "Welcome" }))).toBeVisible();
  if (!(await refused.isVisible())) return;

  await page.goto("/sign-up");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Work email").fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/(home|welcome)/);
}

setup("sign in every worker's account, each with two stores, in the home store", async ({ browser }) => {
  setup.setTimeout(60_000 * E2E_WORKERS);
  const db = neon(process.env.DATABASE_URL!);
  // Stores that already exist have the role requirement on (migration 0020 backfilled it): off before anyone signs in.
  await relaxTwoFactor([...Array.from({ length: E2E_WORKERS }, (_, worker) => accountFor(worker).email), ...ROLE_KEYS.map((key) => roleAccount(key).email)]);
  for (let worker = 0; worker < E2E_WORKERS; worker++) {
    const context = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": ipFor(worker) } });
    const page = await context.newPage();
    await signInOrUp(page, accountFor(worker), `E2E Worker ${worker}`);

    const stores = await db`
      select o.name from organization o
      join member m on m.organization_id = o.id
      join "user" u on u.id = m.user_id
      where u.email = ${accountFor(worker).email}`;
    const has = (name: string) => stores.some((store) => store.name === name);
    if (!has(HOME_STORE)) await createStore(page, HOME_STORE, accountFor(worker).email);
    if (!has(SECOND_STORE)) await createStore(page, SECOND_STORE, accountFor(worker).email);

    await page.goto("/products");
    if ((await currentStore(page).getAttribute("data-store-current")) !== HOME_STORE) {
      await switchStore(page, HOME_STORE);
    }
    await expect(currentStore(page)).toHaveAttribute("data-store-current", HOME_STORE);
    await context.storageState({ path: authFileFor(worker) });
    await context.close();
  }
});

setup("sign in one account per built-in role, all in one shared store, each saved to its own file", async ({ browser }) => {
  setup.setTimeout(120_000);
  // The Store Manager account goes first: it makes the store the others are added to.
  if (ROLE_KEYS[0] !== "store_manager") throw new Error(`ROLE_KEYS must start with store_manager, which makes the store; it starts with ${ROLE_KEYS[0]}.`);
  for (const key of ROLE_KEYS) {
    const context = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": roleIp(key) } });
    const page = await context.newPage();
    const account = roleAccount(key);
    await signInOrUp(page, account, account.name);
    let store = await roleStoreId();
    if (key === "store_manager" && !store) {
      await createStore(page, ROLE_STORE, account.email);
      store = await roleStoreId();
    }
    if (!store) throw new Error(`The Store Manager account has not made ${ROLE_STORE}.`);
    if (key === "store_manager") await seedRoleStore(store);
    else await placeRoleAccount(store, key);
    await page.goto("/products");
    await expect(page.getByRole("searchbox", { name: "Search products" })).toBeVisible();
    await expect(currentStore(page)).toHaveAttribute("data-store-current", ROLE_STORE);
    await context.storageState({ path: roleAuthFile(key) });
    await context.close();
  }
});
