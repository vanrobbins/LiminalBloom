// What the palette offers each built-in role in the shared role store (0.7.0.8 spec section 3.3 table).
// Nothing is saved: each test only opens the palette and reads its Actions. Switch to rows (the theme
// and other stores) are the same for everyone and are left out of the comparison.

import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { optionLabels, openPalette } from "./palette-page";
import type { BuiltinRoleKey } from "../lib/access/roles";

const GO_TO = ["Home", "Products", "Layout", "Planograms", "Store", "Account", "Products not placed", "Sold out products"];
const MANAGE_PRODUCTS = ["Add product", "Categories"];
const MAP = ["Edit the store map"];
const ROLES = ["Roles and permissions"];
const ALWAYS = ["Create a store"];

const ACTIONS: Record<BuiltinRoleKey, string[]> = {
  store_manager: [...MANAGE_PRODUCTS, ...MAP, ...ROLES, ...ALWAYS],
  assistant_manager: [...MANAGE_PRODUCTS, ...MAP, ...ROLES, ...ALWAYS],
  vm_manager: [...MANAGE_PRODUCTS, ...MAP, ...ALWAYS],
  vm_worker: ALWAYS,
  sales_associate: ALWAYS,
};

async function expectActions(page: Page, key: BuiltinRoleKey) {
  await page.goto("/account");
  await openPalette(page);
  expect(await optionLabels(page, "Go to")).toEqual(GO_TO);
  const actions = (await optionLabels(page, "Actions")).filter((label) => !label.startsWith("Switch to "));
  expect(actions).toEqual(ACTIONS[key]);
  // The theme row is everyone's.
  await expect(page.getByRole("option", { name: /^Switch to (dark|light) theme$/ })).toHaveCount(1);
}

const ROLE_NAMES: Record<BuiltinRoleKey, string> = {
  store_manager: "Store Manager",
  assistant_manager: "Assistant Manager",
  vm_manager: "Visual Merchandising Manager",
  vm_worker: "Visual Merchandising Worker",
  sales_associate: "Sales Associate",
};

for (const key of Object.keys(ROLE_NAMES) as BuiltinRoleKey[]) {
  test.describe(ROLE_NAMES[key], () => {
    test.use({ asRole: key });
    test("sees the Actions its switches allow", async ({ page }) => {
      await expectActions(page, key);
    });
  });
}

test.describe("Sales Associate", () => {
  test.use({ asRole: "sales_associate" });
  test("finds no Add product, Categories, Edit the store map or Roles by name", async ({ page }) => {
    await page.goto("/account");
    await openPalette(page);
    for (const word of ["add product", "categories", "edit the store map", "roles and permissions"]) {
      await page.getByRole("combobox").fill(word);
      await expect(page.getByRole("option", { name: new RegExp(`^${word}`, "i") })).toHaveCount(0);
    }
  });
});
