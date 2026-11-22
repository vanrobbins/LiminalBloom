// What the two floor roles see and are refused (spec 0.7, 4.2 and 4.8 part 9): the Visual Merchandising
// Worker can mark sold out and run sales, the Sales Associate can only mark sold out, and neither
// manages people, roles, products, the layout or the store. Each is signed in as its own account in the
// shared role store (auth.setup.ts); nothing here changes its people or roles.

import type { Page } from "@playwright/test";

import { everyEmail, expectEveryoneListed, expectRefused, inviteButton, mainText, NAV, navLabels, openMyProduct, openPeople, peopleWith, rolesLink } from "./access-page";
import { expect, test } from "./fixtures";
import { INVITED, resetRoleProduct } from "./role-store";

test.afterEach(async ({}, testInfo) => {
  await resetRoleProduct(testInfo.parallelIndex);
});

/** What a role without people.manage sees on People: names and roles, nothing else. */
async function expectNamesOnly(page: Page) {
  await openPeople(page);
  expect(await navLabels(page)).toEqual(NAV);
  await expectEveryoneListed(page);
  const text = await mainText(page);
  expect(text).not.toContain("@");
  for (const email of everyEmail()) expect(text).not.toContain(email);
  await expect(page.getByText(/Everyone in the store can see who's here. Your role can't change it./)).toBeVisible();
  await expect(page.getByRole("button", { name: "What's role?" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Invitations waiting" })).toHaveCount(0);
  await expect(page.getByText(INVITED)).toHaveCount(0);
  await expect(inviteButton(page)).toHaveCount(0);
  await expect(rolesLink(page)).toHaveCount(0);
  expect(await peopleWith(page, "Change role for")).toEqual([]);
  expect(await peopleWith(page, "Remove")).toEqual([]);
  await expect(page.getByText("A store always keeps one Store Manager.")).toHaveCount(0);
}

/** Everything a role with only the status switches is turned away from, by page and by what the pages leave out. */
async function expectNoManagement(page: Page) {
  await expectRefused(page, "/store/roles");
  await expectRefused(page, "/roles");
  await expectRefused(page, "/products/new");
  await expectRefused(page, "/products/categories");
  await expectRefused(page, "/layout/edit");
  await page.goto("/products");
  await expect(page.getByRole("searchbox", { name: "Search products" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Add product" })).toHaveCount(0);
  await page.goto("/layout");
  await expect(page.getByText("This store has no layout yet.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Set up your store layout" })).toHaveCount(0);
  await page.goto("/store");
  await expect(page.getByText("Your role can't change these.")).toHaveCount(1);
  await expect(page.getByRole("textbox", { name: "Store name" })).toHaveCount(0);
}

test.describe("Visual Merchandising Worker", () => {
  test.use({ asRole: "vm_worker" });

  test("sees names and roles only on People: no address, invitation, Invite, row button or Roles link", async ({ page }) => {
    await expectNamesOnly(page);
  });

  test("is turned away from Roles, products, categories, the layout editor, and can't rename the store", async ({ page }) => {
    await expectNoManagement(page);
  });

  test("marks a product sold out and puts it on sale, both theirs to do", async ({ page }, testInfo) => {
    await openMyProduct(page, testInfo);
    await page.getByRole("radio", { name: "On sale" }).click();
    await expect(page.getByRole("radio", { name: "On sale" })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("radio", { name: "On sale" }).locator("[data-check]")).toHaveClass(/opacity-100/);
    await page.getByRole("radio", { name: "Sold out" }).click();
    await expect(page.getByRole("radio", { name: "Sold out" })).toHaveAttribute("aria-checked", "true");
  });
});

test.describe("Sales Associate", () => {
  test.use({ asRole: "sales_associate" });

  test("sees names and roles only on People: no address, invitation, Invite, row button or Roles link", async ({ page }) => {
    await expectNamesOnly(page);
  });

  test("is turned away from Roles, products, categories, the layout editor, and can't rename the store", async ({ page }) => {
    await expectNoManagement(page);
  });

  test("can mark a product sold out and put it back, but is never offered On sale", async ({ page }, testInfo) => {
    await openMyProduct(page, testInfo);
    // The control offers only what this role may choose.
    await expect(page.getByRole("radio", { name: "Sold out" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "On sale" })).toHaveCount(0);
    await page.getByRole("radio", { name: "Sold out" }).click();
    await expect(page.getByRole("radio", { name: "Sold out" })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("radio", { name: "Sold out" }).locator("[data-check]")).toHaveClass(/opacity-100/);
    await expect(page.getByRole("radio", { name: "On sale" })).toHaveCount(0);
    // Choosing the previous status again is the undo (no toast, no Undo button).
    await page.getByRole("radio", { name: "In stock" }).click();
    await expect(page.getByRole("radio", { name: "In stock" })).toHaveAttribute("aria-checked", "true");
  });
});
