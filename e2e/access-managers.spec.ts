// What the three managing roles see and are refused (spec 0.7, 4.8 part 9), each signed in as its own
// account in the shared role store (auth.setup.ts). Nothing here changes the store's people or roles, so
// workers share it; a role edit reaching a person live is roles-edit.spec.ts.

import type { Page } from "@playwright/test";

import { everyEmail, expectEveryoneListed, expectRefused, inviteRoles, invitationRow, mainText, NAV, navLabels, openMyProduct, openPeople, peopleWith, rolesLink } from "./access-page";
import { expect, test } from "./fixtures";
import { box, openRoles, reveal } from "./roles-page";
import { INVITED, resetRoleProduct } from "./role-store";
import { ROLE_PEOPLE } from "./test-account";

const { assistant_manager: ada, sales_associate: sal, store_manager: mara, vm_manager: vera, vm_worker: walt } = ROLE_PEOPLE;

test.afterEach(async ({}, testInfo) => {
  await resetRoleProduct(testInfo.parallelIndex);
});

const addProduct = (page: Page) => page.getByRole("link", { name: "Add product" });
const setUpLayout = (page: Page) => page.getByRole("link", { name: "Set up your store layout" });

async function expectEveryAddress(page: Page) {
  const text = await mainText(page);
  for (const email of everyEmail()) expect(text).toContain(email);
}

test.describe("Store Manager", () => {
  test.use({ asRole: "store_manager" });

  test("sees every address and the waiting invitation, and may act on every row below the top, never on themselves", async ({ page }) => {
    await openPeople(page);
    expect(await navLabels(page)).toEqual(NAV);
    await expectEveryoneListed(page);
    await expectEveryAddress(page);
    await expect(page.getByRole("listitem").filter({ hasText: mara })).toContainText("(you)");
    await expect(page.getByRole("heading", { name: "Invitations waiting" })).toBeVisible();
    await expect(invitationRow(page)).toContainText(/Sales Associate role · Expires/);
    await expect(page.getByRole("button", { name: `Copy link for ${INVITED}` })).toBeVisible();
    await expect(page.getByRole("button", { name: `Cancel invitation for ${INVITED}` })).toBeVisible();
    expect(await peopleWith(page, "Change role for")).toEqual([ada, vera, walt, sal]);
    expect(await peopleWith(page, "Remove")).toEqual([ada, vera, walt, sal]);
    await expect(page.getByText(/Everyone in the store can see who's here/)).toHaveCount(0);
  });

  test("is the only Store Manager, so People says the store keeps one and offers no way to remove or re-role them", async ({ page }) => {
    await openPeople(page);
    await expect(page.getByText("A store always keeps one Store Manager.")).toBeVisible();
    await expect(page.getByRole("button", { name: "What's store manager?" })).toBeVisible();
    await expect(page.getByRole("button", { name: new RegExp(`^(Change role for|Remove) ${mara}$`) })).toHaveCount(0);
  });

  test("invites into every role below, opens Roles with their own row read-only, edits the store and sets up the layout", async ({ page }) => {
    await openPeople(page);
    expect(await inviteRoles(page)).toEqual(["Assistant Manager", "Visual Merchandising Manager", "Visual Merchandising Worker", "Sales Associate"]);
    await page.keyboard.press("Escape");
    await expect(rolesLink(page)).toBeVisible();
    await openRoles(page);
    await reveal(page, "Store Manager");
    await expect(box(page, "Run sales", "Store Manager")).toBeDisabled();
    await reveal(page, "Assistant Manager");
    await expect(box(page, "Store settings", "Assistant Manager")).toBeEnabled();
    await page.goto("/store");
    await expect(page.getByRole("textbox", { name: "Store name" })).toBeVisible();
    await page.goto("/layout");
    await expect(setUpLayout(page)).toBeVisible();
    await page.goto("/products");
    await expect(addProduct(page)).toBeVisible();
  });

  test("changes a product's status every way, sold out and on sale", async ({ page }, testInfo) => {
    await openMyProduct(page, testInfo);
    for (const status of ["Sold out", "On sale"]) {
      await page.getByRole("radio", { name: status }).click();
      await expect(page.getByRole("radio", { name: status })).toHaveAttribute("aria-checked", "true");
      await expect(page.getByRole("radio", { name: status }).locator("[data-check]")).toHaveClass(/opacity-100/);
    }
  });
});

test.describe("Assistant Manager", () => {
  test.use({ asRole: "assistant_manager" });

  test("sees every address and invitation, and may act only on the three roles below, not on the Store Manager or themselves", async ({ page }) => {
    await openPeople(page);
    await expectEveryoneListed(page);
    await expectEveryAddress(page);
    await expect(invitationRow(page)).toBeVisible();
    expect(await peopleWith(page, "Change role for")).toEqual([vera, walt, sal]);
    expect(await peopleWith(page, "Remove")).toEqual([vera, walt, sal]);
    await expect(page.getByRole("listitem").filter({ hasText: ada })).toContainText("(you)");
    // That line is for the sole Store Manager's own group, so only the Store Manager sees it.
    await expect(page.getByText("A store always keeps one Store Manager.")).toHaveCount(0);
    expect(await inviteRoles(page)).toEqual(["Visual Merchandising Manager", "Visual Merchandising Worker", "Sales Associate"]);
  });

  test("opens Roles but changes only the roles below: the Store Manager, their own and every Store settings cell are read-only", async ({ page }) => {
    await openPeople(page);
    await expect(rolesLink(page)).toBeVisible();
    await openRoles(page);
    await reveal(page, "Store Manager");
    await expect(box(page, "Run sales", "Store Manager")).toBeDisabled();
    await reveal(page, "Assistant Manager");
    await expect(box(page, "Run sales", "Assistant Manager")).toBeDisabled();
    await reveal(page, "Visual Merchandising Manager");
    await expect(box(page, "Run sales", "Visual Merchandising Manager")).toBeEnabled();
    await expect(box(page, "Store settings", "Visual Merchandising Manager")).toBeDisabled();
  });

  test("can't change the store's name or time zone, and can set up the layout and add products", async ({ page }) => {
    await page.goto("/store");
    await expect(page.getByRole("heading", { level: 1, name: "Store settings" })).toBeVisible();
    await expect(page.getByText("Your role can't change this.")).toHaveCount(2);
    await expect(page.getByRole("textbox", { name: "Store name" })).toHaveCount(0);
    await page.goto("/layout");
    await expect(setUpLayout(page)).toBeVisible();
    await page.goto("/products");
    await expect(addProduct(page)).toBeVisible();
  });
});

test.describe("Visual Merchandising Manager", () => {
  test.use({ asRole: "vm_manager" });

  test("sees every address and invitation, and may act only on the Worker and the Sales Associate", async ({ page }) => {
    await openPeople(page);
    await expectEveryoneListed(page);
    await expectEveryAddress(page);
    expect(await peopleWith(page, "Change role for")).toEqual([walt, sal]);
    expect(await peopleWith(page, "Remove")).toEqual([walt, sal]);
    await expect(page.getByRole("button", { name: `Cancel invitation for ${INVITED}` })).toBeVisible();
    expect(await inviteRoles(page)).toEqual(["Visual Merchandising Worker", "Sales Associate"]);
  });

  test("has no link to Roles, and Roles itself is refused; the store's name and time zone are read-only", async ({ page }) => {
    await openPeople(page);
    await expect(rolesLink(page)).toHaveCount(0);
    expect(await navLabels(page)).toEqual(NAV);
    await expectRefused(page, "/roles");
    await page.goto("/store");
    await expect(page.getByText("Your role can't change this.")).toHaveCount(2);
  });

  test("edits products and the layout: Add product, the product form and the layout set-up are theirs", async ({ page }) => {
    await page.goto("/products");
    await expect(addProduct(page)).toBeVisible();
    await page.goto("/products/new");
    await expect(page).not.toHaveURL(/\/no-access$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByLabel("Style number")).toBeVisible();
    await page.goto("/layout");
    await expect(setUpLayout(page)).toBeVisible();
  });
});
