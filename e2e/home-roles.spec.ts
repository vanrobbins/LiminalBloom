// What each built-in role's Home shows in the shared role store (0.7.0.6 spec section 4 table): cards are chosen
// by switches, so a role sees exactly the cards its switches allow that the store's data can fill. The role store
// has no layout (access-staff asserts it), so Planograms to finish and Recently published are in home.spec.ts.
// What it does hold: no layout, products nobody placed, one waiting invitation and the access event for it.

import type { Page } from "@playwright/test";

import { everyEmail, mainText, NAV, navLabels } from "./access-page";
import { expect, hydrated, test } from "./fixtures";
import { unplacedProducts } from "./home-store";
import { INVITED, roleStoreId } from "./role-store";
import { ROLE_PEOPLE } from "./test-account";
import type { BuiltinRoleKey } from "../lib/access/roles";

const CARDS: Record<BuiltinRoleKey, string[]> = {
  store_manager: ["Set up the store", "Invitations waiting", "Not placed yet", "Recent changes"],
  assistant_manager: ["Set up the store", "Invitations waiting", "Not placed yet", "Recent changes"],
  vm_manager: ["Set up the store", "Invitations waiting", "Not placed yet"],
  vm_worker: ["Not placed yet"],
  sales_associate: [],
};

const CALM = "Nothing needs you right now.";

async function openHome(page: Page, key: BuiltinRoleKey) {
  await page.goto("/home");
  await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible();
  // The cards stream in behind a loader: wait for the first card, or the calm line.
  await expect(CARDS[key].length > 0 ? page.getByRole("heading", { level: 2 }).first() : page.getByText(CALM)).toBeVisible();
  await hydrated(page);
  expect(await navLabels(page)).toEqual(NAV);
  await expect(page.getByRole("search").getByRole("searchbox", { name: "Search products" })).toBeVisible();
  expect(await page.getByRole("main").getByRole("heading", { level: 2 }).allTextContents()).toEqual(CARDS[key]);
}

const card = (page: Page, title: string) => page.getByRole("region", { name: title });

async function expectNotPlaced(page: Page) {
  const products = await unplacedProducts((await roleStoreId())!);
  await expect(card(page, "Not placed yet").getByRole("link", { name: `${products} ${products === 1 ? "product" : "products"} not placed` })).toHaveAttribute("href", "/products?place=unplaced");
  await expect(card(page, "Not placed yet").getByText("without a planogram")).toHaveCount(0);
}

/** A role with people.manage: the invitation row with its address, and the Set up row for the missing layout. */
async function expectManagersCards(page: Page) {
  await expect(card(page, "Invitations waiting").getByRole("listitem").filter({ hasText: INVITED })).toContainText("Sales Associate role · Expires");
  await expect(card(page, "Invitations waiting").getByRole("link", { name: "All people", exact: true })).toHaveAttribute("href", "/people");
  await expect(card(page, "Set up the store").getByRole("link", { name: "Draw the store layout" })).toHaveAttribute("href", "/layout/edit");
  // The role store has products and five people: those two steps are done.
  await expect(card(page, "Set up the store").getByRole("listitem")).toHaveCount(1);
}

async function expectChanges(page: Page) {
  await expect(card(page, "Recent changes").getByRole("listitem").filter({ hasText: `${ROLE_PEOPLE.store_manager} invited ${INVITED} as Sales Associate` })).toBeVisible();
  await expect(card(page, "Recent changes").getByRole("link", { name: /^All roles/ })).toHaveAttribute("href", "/roles");
}

/** Nothing of the people-managers' data reaches a role without people.manage. */
async function expectNoEmails(page: Page) {
  const text = await mainText(page);
  expect(text).not.toContain("@");
  for (const email of [INVITED, ...everyEmail()]) expect(text).not.toContain(email);
  await expect(card(page, "Invitations waiting")).toHaveCount(0);
  await expect(card(page, "Recent changes")).toHaveCount(0);
}

test.describe("Store Manager", () => {
  test.use({ asRole: "store_manager" });
  test("sees setup, invitations with the address, not placed and recent changes", async ({ page }) => {
    await openHome(page, "store_manager");
    await expectManagersCards(page);
    await expectNotPlaced(page);
    await expectChanges(page);
  });
});

test.describe("Assistant Manager", () => {
  test.use({ asRole: "assistant_manager" });
  test("sees the same four cards as the Store Manager", async ({ page }) => {
    await openHome(page, "assistant_manager");
    await expectManagersCards(page);
    await expectNotPlaced(page);
    await expectChanges(page);
  });
});

test.describe("Visual Merchandising Manager", () => {
  test.use({ asRole: "vm_manager" });
  test("sees setup, invitations and not placed, but not recent changes", async ({ page }) => {
    await openHome(page, "vm_manager");
    await expectManagersCards(page);
    await expectNotPlaced(page);
    await expect(card(page, "Recent changes")).toHaveCount(0);
    await expect(page.getByText(`invited ${INVITED}`)).toHaveCount(0);
  });
});

test.describe("Visual Merchandising Worker", () => {
  test.use({ asRole: "vm_worker" });
  test("sees only Not placed yet, and no address anywhere", async ({ page }) => {
    await openHome(page, "vm_worker");
    await expectNotPlaced(page);
    await expect(card(page, "Set up the store")).toHaveCount(0);
    await expectNoEmails(page);
  });
});

test.describe("Sales Associate", () => {
  test.use({ asRole: "sales_associate" });
  test("sees the calm line under the search, no card, and no address", async ({ page }) => {
    await openHome(page, "sales_associate");
    await expect(page.getByText(CALM)).toBeVisible();
    await expect(page.getByRole("main").getByRole("region")).toHaveCount(0);
    await expectNoEmails(page);
  });
});
