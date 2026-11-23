// What each company role sees (0.7.1b, B11; spec 15): the owner and a corporate admin reach everything of the
// company, a regional manager only their region and read-only, and a person of one store never sees the owner
// or the corporate admins. The company has two stores, one in North and one in South; each person is its own
// browser. The people are written in the database (company-store.ts): the invitations are company.spec's.

import type { BrowserContext, Page } from "@playwright/test";

import { addRegionAndStore, clearCompanies, grantCompanyRole, joinStore, newEmail, newGuest, signUpOwnerWithStore, signUpPlain } from "./company-store";
import { expect, hydrated, openStoreChoices, test } from "./fixtures";
import { inviteButton } from "./invite-page";

test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ mode: "serial" });

const suffix = Math.random().toString(36).slice(2, 8);
const NORTH = `Roles North ${suffix}`;
const SOUTH = `Roles South ${suffix}`;
const COMPANY = `Roles Co ${suffix}`;
const emails = { owner: newEmail(), admin: newEmail(), regional: newEmail(), staff: newEmail() };
const people: Record<string, { context: BrowserContext; page: Page }> = {};

test.beforeAll(async ({ browser }, testInfo) => {
  test.setTimeout(240_000);
  for (const key of Object.keys(emails)) people[key] = await newGuest(browser, testInfo);
  await signUpOwnerWithStore(people.owner.page, emails.owner, NORTH, COMPANY);
  await addRegionAndStore(people.owner.page, "South", SOUTH);
  for (const key of ["admin", "regional", "staff"]) await signUpPlain(people[key].page, emails[key as keyof typeof emails], key === "admin" ? "Corp Admin" : "Acct Tester");
  await grantCompanyRole(emails.admin, emails.owner, "corporate_admin");
  await grantCompanyRole(emails.regional, emails.owner, "regional_manager", "North");
  // The owner made North, so holds a seat there; South, added from /company, has no one but this person.
  await joinStore(emails.staff, SOUTH, "store_manager");
});
test.afterAll(async () => {
  for (const { context } of Object.values(people)) await context?.close();
  await clearCompanies();
});

async function open(page: Page, path: string) {
  await page.goto(path);
  await hydrated(page);
}

test("a regional manager sees only their region, read-only, and is refused Roles", async () => {
  const { page } = people.regional;
  await open(page, "/company");
  await expect(page.getByText("Regional Manager · North")).toBeVisible();
  await expect(page.getByRole("region", { name: "Stores" }).getByText(NORTH)).toBeVisible();
  await expect(page.getByRole("region", { name: "Stores" }).getByText(SOUTH)).toHaveCount(0);
  await expect(page.getByRole("region", { name: "People" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add store" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add region" })).toHaveCount(0);
  // The switcher lists their one store (with the region filter gone it would list South too).
  await openStoreChoices(page);
  await expect(page.locator("[data-store-name]").filter({ visible: true })).toHaveText([NORTH]);
  await page.keyboard.press("Escape");

  await open(page, "/store");
  await expect(page.getByText(`Part of ${COMPANY} · North`)).toBeVisible();
  await expect(inviteButton(page)).toBeVisible();
  await open(page, "/layout");
  await expect(page.getByRole("button", { name: "Edit", exact: true })).toHaveCount(0);
  await page.goto("/store/roles");
  await page.waitForURL("**/no-access");
});

for (const who of ["owner", "admin"] as const) {
  test(`the ${who === "admin" ? "corporate admin" : "owner"} reaches every store, People, Roles and the switcher's groups`, async () => {
    const { page } = people[who];
    await open(page, "/company");
    await expect(page.getByRole("region", { name: "Stores" }).getByText(NORTH)).toBeVisible();
    await expect(page.getByRole("region", { name: "Stores" }).getByText(SOUTH)).toBeVisible();
    await expect(page.getByRole("region", { name: "People" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add store" })).toBeVisible();
    // Ownership is the owner's alone.
    await expect(page.locator("#ownership")).toHaveCount(who === "owner" ? 1 : 0);

    // Roles opens in a company store, for a company person with no seat in it.
    await open(page, "/store/roles");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page).toHaveURL(/\/store\/roles$/);

    // The switcher's groups are named: the company, then its regions with their store counts.
    await open(page, "/home");
    await openStoreChoices(page);
    await expect(page.getByRole("group", { name: COMPANY })).toBeVisible();
    await expect(page.getByRole("group", { name: "North · 1" })).toBeVisible();
    await expect(page.getByRole("group", { name: "South · 1" })).toBeVisible();
  });
}

test("a person of one store never sees the owner or the corporate admins", async () => {
  const { page } = people.staff;
  await open(page, "/store");
  await expect(page.getByRole("heading", { level: 1, name: "Store" })).toBeVisible();
  const text = await page.getByRole("main").innerText();
  expect(text).toContain("People · 1");
  for (const hidden of [emails.owner, emails.admin, "Corp Admin"]) expect(text, hidden).not.toContain(hidden);
  // Nor is /company theirs.
  await page.goto("/company");
  await page.waitForURL("**/no-access");
});
