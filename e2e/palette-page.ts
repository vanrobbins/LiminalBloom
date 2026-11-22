// Helpers for the command palette specs (0.7.0.8 spec section 12): open it the way this size does,
// and read what it lists.

import type { Page } from "@playwright/test";

import { expect, hydrated, sizeOf, test } from "./fixtures";

export const paletteDialog = (page: Page) => page.getByRole("dialog", { name: "Search the store" });
export const paletteField = (page: Page) => paletteDialog(page).getByRole("combobox");
/** The Search button of whichever shell form shows (sidebar button, rail or header icon). */
export const searchTrigger = (page: Page) => page.locator("button[aria-keyshortcuts]").filter({ visible: true });
const group = (page: Page, name: string) => paletteDialog(page).getByRole("group", { name, exact: true });

/** Opens it the way this size does: Ctrl+K on a desktop, the icon on a phone or tablet. The field has focus. */
export async function openPalette(page: Page) {
  await hydrated(page);
  if (sizeOf(test.info()) === "desktop") await page.keyboard.press("Control+K");
  else await searchTrigger(page).click();
  await expect(paletteDialog(page)).toBeVisible();
  await expect(paletteField(page)).toBeFocused();
}

/** The label of each option in a group, in order (a heading's group, not the whole list). */
export async function optionLabels(page: Page, heading: string): Promise<string[]> {
  const rows = group(page, heading).getByRole("option");
  return rows.evaluateAll((els) => els.map((e) => e.querySelector("span.truncate")?.textContent ?? ""));
}

export const hasGroup = (page: Page, heading: string) => group(page, heading);
