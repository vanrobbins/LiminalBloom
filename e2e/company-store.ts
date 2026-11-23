// Disposable company people for the /company specs (0.7.1b, B6; B11 extends them). A real sign-up through the
// screens, then the company is written straight to the development database, as the rest of the e2e setup does
// (map-store.ts): there is no screen for it yet. Every company role requires two-factor (DECISIONS 11-23), so the
// account is flagged as having it; the app reads that flag, not a session proof. `clearCompanies` removes the
// people, the stores they made and the companies, in the order the foreign keys need.

import { randomUUID } from "node:crypto";

import type { Page } from "@playwright/test";

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

/** Owner of a new company with no store at all: they reach only /company. */
export async function signUpCompanyOnly(page: Page, email: string, company = "E2E Company") {
  await ownAddress(page);
  await page.goto("/sign-up");
  await hydrated(page);
  await page.getByLabel("Name").fill("Acct Tester");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/(home|welcome)/);
  const db = sql();
  const [owner] = await db`select id from "user" where email = ${email}`;
  await db`update "user" set two_factor_enabled = true where id = ${owner.id}`;
  await db`insert into companies (name, slug, owner_user_id) values (${company}, ${`e2e-co-${randomUUID().slice(0, 8)}`}, ${owner.id})`;
}

/** Removes every account made here, the stores of their companies (one added from /company has no member row) and the companies. */
export async function clearCompanies(): Promise<void> {
  const db = sql();
  await db`delete from organization where id in (select sp.store_id from store_profiles sp join companies c on c.id = sp.company_id join "user" u on u.id = c.owner_user_id where u.email like ${MINE})`;
  await db`delete from organization where id in (select m.organization_id from member m join "user" u on u.id = m.user_id where u.email like ${MINE})`;
  await db`delete from companies where owner_user_id in (select id from "user" where email like ${MINE})`;
  await db`delete from "user" where email like ${MINE}`;
}
