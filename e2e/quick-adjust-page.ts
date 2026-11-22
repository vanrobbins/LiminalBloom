// What the Quick Adjust specs do on the adjust page and the planogram's Published view (0.7.0.9 task 8).

import type { Page } from "@playwright/test";

import { expect, hydrated } from "./fixtures";
import { SLIM, type AdjustSeed } from "./quick-adjust-store";

export const choices = (page: Page) => page.getByRole("radiogroup", { name: "Replace with" });
export const bar = (page: Page) => page.locator("[data-adjust-bar]");
export const tile = (page: Page, name: RegExp | string) => page.getByRole("button", { name }).filter({ visible: true });

/** The adjust page with the sold-out pant's tile selected and its panel open (?product=). */
export async function openAdjust(page: Page, seed: AdjustSeed) {
  await page.goto(seed.adjustUrl);
  // By tag, not role: on a phone the open sheet hides the page behind it from the accessibility tree.
  await expect(page.locator("h1", { hasText: "Table 1" })).toBeAttached();
  await expect(choices(page)).toBeVisible();
  await hydrated(page);
}

/** Taps a choice and waits for the panel's own line to say Saved (the choice is one request; no Save button). */
export async function choose(page: Page, name: RegExp | string) {
  const radio = choices(page).getByRole("radio", { name });
  await radio.click();
  await expect(radio).toHaveAttribute("aria-checked", "true");
  await expect(page.locator("[data-panel-status]")).toHaveText("Saved");
}

/** On a phone the panel is a sheet over the page: close it to reach the bar. Elsewhere it sits beside the grid. */
export async function closePanel(page: Page, phone: boolean) {
  if (!phone) return;
  const sheet = page.getByRole("dialog").filter({ has: choices(page) });
  await sheet.getByRole("button", { name: "Close" }).click();
  await expect(sheet).toBeHidden();
}

/** The Publish icon in the bar, then Compare's Publish button; lands on the planogram's Published view. */
export async function publishFromBar(page: Page, seed: AdjustSeed) {
  await bar(page).getByRole("button", { name: "Publish" }).click();
  await page.getByRole("button", { name: /^Publish to / }).click();
  await expect(page).toHaveURL(new RegExp(`/planograms/${seed.fixtureId}$`));
  await expect(page.locator('[data-adjustment="published"]')).toContainText("Quick Adjust · since");
}

/** The whole core loop from the adjust page: the first suggestion, then publish. */
export async function adjustAndPublish(page: Page, seed: AdjustSeed, phone: boolean) {
  await openAdjust(page, seed);
  await choose(page, new RegExp(`^${SLIM}`));
  await closePanel(page, phone);
  await publishFromBar(page, seed);
}
