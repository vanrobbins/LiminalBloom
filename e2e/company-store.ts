// Disposable company people for the /company specs (0.7.1b, B6; B11 added the other roles). A real sign-up through the
// screens, then the company is written straight to the development database, as the rest of the e2e setup does
// (map-store.ts): there is no screen for it yet. Every company role requires two-factor (DECISIONS 11-23), so the
// account is flagged as having it; the app reads that flag, not a session proof. `clearCompanies` removes the
// people, the stores they made and the companies, in the order the foreign keys need.

import { randomUUID } from "node:crypto";

import type { Browser, BrowserContext, Page, TestInfo } from "@playwright/test";

import { newEmail, PASSWORD, signUpWithStore } from "./account-store";
import { hydrated } from "./fixtures";
import { sql } from "./map-store";

export { newEmail };

const worker = Number(process.env.TEST_PARALLEL_INDEX ?? 0);
/** Sign-ups are limited per address and each of these tests makes one: every person gets an address of their own. */
async function ownAddress(page: Page) {
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": `10.8.${worker}.${1 + Math.floor(Math.random() * 250)}` });
}

const MINE = `e2e_acct_${worker}_%@example.test`;

/** Owner of a new company called `company`, with a region North, in a store of their own called `storeName` that sits in it. */
export async function signUpOwnerWithStore(page: Page, email: string, storeName: string, company = "E2E Company") {
  await ownAddress(page);
  await signUpWithStore(page, email, storeName);
  const db = sql();
  const [owner] = await db`select id from "user" where email = ${email}`;
  await db`update "user" set two_factor_enabled = true where id = ${owner.id}`;
  const [made] = await db`insert into companies (name, slug, owner_user_id) values (${company}, ${`e2e-co-${randomUUID().slice(0, 8)}`}, ${owner.id}) returning id`;
  const [region] = await db`insert into regions (company_id, name) values (${made.id}, 'North') returning id`;
  await db`insert into store_profiles (store_id, company_id, region_id) select m.organization_id, ${made.id}, ${region.id} from member m where m.user_id = ${owner.id}`;
}

/** A new account on the sign-up screen with no store: it lands on /welcome. */
export async function signUpPlain(page: Page, email: string, name = "Acct Tester") {
  await ownAddress(page);
  await page.goto("/sign-up");
  await hydrated(page);
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/(home|welcome)/);
}

/** Makes the account the owner of a new company, straight in the database, as an approval would (company-request.spec is the real approval). Every company role asks for two-factor, so it is flagged. */
export async function approveByDb(email: string, company: string) {
  const db = sql();
  const [owner] = await db`select id from "user" where email = ${email}`;
  await db`update "user" set two_factor_enabled = true where id = ${owner.id}`;
  await db`insert into companies (name, slug, owner_user_id) values (${company}, ${`e2e-co-${randomUUID().slice(0, 8)}`}, ${owner.id})`;
}

/** Owner of a new company with no store at all: they reach only /company. */
export async function signUpCompanyOnly(page: Page, email: string, company = "E2E Company") {
  await signUpPlain(page, email);
  await approveByDb(email, company);
}

/** A browser the size of this project with nobody signed in, for one more person in a spec (the page fixture is the first). */
export async function newGuest(browser: Browser, testInfo: TestInfo): Promise<{ context: BrowserContext; page: Page }> {
  const { viewport, hasTouch, isMobile, colorScheme, baseURL } = testInfo.project.use;
  const context = await browser.newContext({ viewport, hasTouch, isMobile, colorScheme, baseURL, storageState: { cookies: [], origins: [] } });
  return { context, page: await context.newPage() };
}

const companyOf = async (ownerEmail: string) => (await sql()`select c.id from companies c join "user" u on u.id = c.owner_user_id where u.email = ${ownerEmail}`)[0].id as string;

/** Gives an account (signed up, no store) a company role in the owner's company, straight in the database; flagged for two-factor, which every company role asks for. */
export async function grantCompanyRole(email: string, ownerEmail: string, role: "corporate_admin" | "regional_manager", region?: string) {
  const db = sql();
  const company = await companyOf(ownerEmail);
  await db`update "user" set two_factor_enabled = true where email = ${email}`;
  await db`insert into role_assignments (user_id, company_id, role, region_id) select u.id, ${company}, ${role}, (select id from regions where company_id = ${company} and name = ${region ?? ""}) from "user" u where u.email = ${email}`;
}

/** Puts an account in a store as one of its own people (a member row), flagged for two-factor. */
export async function joinStore(email: string, storeName: string, builtin: "store_manager" | "sales_associate") {
  const db = sql();
  await db`update "user" set two_factor_enabled = true where email = ${email}`;
  await db`insert into member (id, organization_id, user_id, role, created_at, role_id)
    select ${randomUUID()}, o.id, u.id, 'member', now(), (select id from role_definitions where store_id = o.id and builtin = ${builtin})
    from organization o, "user" u where o.name = ${storeName} and u.email = ${email}`;
}

/** Removes every account made here, the stores of their companies (one added from /company has no member row) and the companies. */
export async function clearCompanies(): Promise<void> {
  const db = sql();
  await db`delete from organization where id in (select sp.store_id from store_profiles sp join companies c on c.id = sp.company_id join "user" u on u.id = c.owner_user_id where u.email like ${MINE})`;
  await db`delete from organization where id in (select m.organization_id from member m join "user" u on u.id = m.user_id where u.email like ${MINE})`;
  await db`delete from companies where owner_user_id in (select id from "user" where email like ${MINE})`;
  await db`delete from "user" where email like ${MINE}`;
}

/** Adds a region on /company through its dialog, then a store in it; ends on the new store's Home. */
export async function addRegionAndStore(page: Page, region: string, store: string) {
  await page.goto("/company");
  await hydrated(page);
  await page.getByRole("button", { name: "Add region" }).click();
  await page.getByRole("dialog").getByLabel("Name").fill(region);
  await page.getByRole("dialog").getByRole("button", { name: "Add region" }).click();
  await page.getByRole("region", { name: "Regions" }).getByText(region).waitFor();
  await page.getByRole("button", { name: "Add store" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Store name").fill(store);
  await dialog.getByLabel("Region").selectOption({ label: region });
  await dialog.getByRole("button", { name: "Add store" }).click();
  await page.waitForURL("**/home");
}
