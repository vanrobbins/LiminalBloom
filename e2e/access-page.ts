// Helpers for the per-role specs (plan 0.7.0 task 12): what a signed-in role sees on People, Products and the
// pages it is refused. The accounts and the store they share are made in setup (auth.setup.ts, role-store.ts).

import type { Page, TestInfo } from "@playwright/test";

import { expect, hydrated } from "./fixtures";
import { INVITED, roleProduct } from "./role-store";
import { ROLE_KEYS, ROLE_PEOPLE, roleAccount } from "./test-account";

export const mainNav = (page: Page) => page.locator("nav[data-nav]").filter({ visible: true });
export const inviteButton = (page: Page) => page.getByRole("button", { name: /^Invite( someone)?$/ });
export const rolesLink = (page: Page) => page.getByRole("link", { name: "Roles and permissions" });
export const mainText = (page: Page) => page.getByRole("main").innerText();

export async function openPeople(page: Page) {
  await page.goto("/people");
  await hydrated(page);
  await expect(page.getByRole("heading", { level: 1, name: "People" })).toBeVisible();
}

/** Who has a button of this kind on their row, by name, in list order. */
export async function peopleWith(page: Page, button: "Change role for" | "Remove"): Promise<string[]> {
  const labels = await page.getByRole("button", { name: new RegExp(`^${button} `) }).evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")!));
  return labels.map((label) => label.slice(button.length + 1));
}

/** Every role's person is in the list, whatever the role is, and the groups run from the top rank down. */
export async function expectEveryoneListed(page: Page) {
  const headings = await page.locator("main h2").allTextContents();
  expect(headings.filter((h) => h.includes(" · "))).toEqual(["Store Manager · 1", "Assistant Manager · 1", "Visual Merchandising Manager · 1", "Visual Merchandising Worker · 1", "Sales Associate · 1"]);
  for (const name of Object.values(ROLE_PEOPLE)) await expect(page.getByRole("listitem").filter({ hasText: name }).first()).toBeVisible();
}

export const everyEmail = () => ROLE_KEYS.map((key) => roleAccount(key).email);

/** What the role may see of the invitation waiting in the store (made in setup). */
export const invitationRow = (page: Page) => page.getByRole("listitem").filter({ hasText: INVITED });

/** The roles Invite offers, top rank first. Leaves the dialog open. */
export async function inviteRoles(page: Page): Promise<string[]> {
  await inviteButton(page).click();
  await expect(page.getByRole("dialog", { name: "Invite someone" })).toBeVisible();
  return page.getByLabel("Role", { exact: true }).locator("option").allTextContents();
}

/** A page this role is refused: the app sends it to /no-access, which says so and links back to Home. */
export async function expectRefused(page: Page, path: string) {
  await page.goto(path);
  await expect(page).toHaveURL(/\/no-access$/);
  await expect(page.getByRole("heading", { level: 1, name: "You don't have access to this" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to Home" })).toBeVisible();
}

export const navLabels = (page: Page) => mainNav(page).getByRole("link").allTextContents();
export const NAV = ["Home", "Products", "Layout", "Planograms", "People"];

/** Opens this worker's own product, so workers sharing the store never change the same one. */
export async function openMyProduct(page: Page, testInfo: TestInfo) {
  const { name, style } = roleProduct(testInfo.parallelIndex);
  await page.goto(`/products?q=${style}`);
  await hydrated(page);
  await page.getByRole("main").getByRole("list").first().getByRole("button", { name: new RegExp(`^${name}`) }).click();
  await expect(page.getByRole("radio", { name: "In stock" })).toHaveAttribute("aria-checked", "true");
  return name;
}
