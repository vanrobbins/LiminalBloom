// Helpers for the Roles screen's e2e specs. The screen has two forms in the page at once, a table from 768 px
// and a fold per role below it, one hidden by CSS, so each helper picks by width and Playwright's role queries
// see only the visible form.

import type { Page } from "@playwright/test";

import { expect, hydrated } from "./fixtures";

export const narrow = (page: Page) => page.viewportSize()!.width < 768;

export async function openRoles(page: Page) {
  await page.goto("/roles");
  await hydrated(page);
  await expect(page.getByRole("heading", { level: 1, name: "Roles and permissions" })).toBeVisible();
}

/** On a phone a role's permissions are behind its fold; the table has them all showing. */
export async function reveal(page: Page, role: string) {
  if (!narrow(page)) return;
  const header = page.locator(`[data-role-fold="${role}"] h3 button`);
  if ((await header.getAttribute("aria-expanded")) !== "true") await header.click();
}

export const box = (page: Page, permission: string, role: string) => page.getByRole("checkbox", { name: `${permission} for ${role}`, exact: true });

/** Rename, Reset to default, Delete, Move up, Move down: a ⋯ menu item on wide screens, a button in the fold on a phone. */
export async function act(page: Page, role: string, action: string) {
  if (narrow(page)) {
    await reveal(page, role);
    await page.getByRole("button", { name: `${action} ${role}` }).click();
  } else {
    await page.getByRole("button", { name: `More for ${role}` }).click();
    await page.getByRole("menuitem", { name: action }).click();
  }
}

/** The actions on offer for a role, in order. */
export async function actionsOf(page: Page, role: string): Promise<string[]> {
  if (narrow(page)) {
    await reveal(page, role);
    const labels = await page.locator(`[data-role-fold="${role}"] button[aria-label$=" ${role}"]`).evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")!));
    return labels.map((l) => l.slice(0, -role.length - 1));
  }
  await page.getByRole("button", { name: `More for ${role}` }).click();
  const items = await page.getByRole("menuitem").allTextContents();
  await page.keyboard.press("Escape");
  return items;
}

export const roleOrder = (page: Page) =>
  page.locator(narrow(page) ? "[data-role-fold]" : "[data-role-name]").evaluateAll((els) => els.map((e) => e.getAttribute("data-role-fold") ?? e.getAttribute("data-role-name")));

export async function reviewAndSave(page: Page, heading: RegExp | string) {
  await page.getByRole("button", { name: "Review and save" }).click();
  const dialog = page.getByRole("dialog", { name: heading });
  await expect(dialog).toBeVisible();
  return dialog;
}
