// Steps that bring a swept control into view for tooltips.spec.ts: a staged role change, an open role fold,
// a selected frame rack, a run, a half-drawn outline.

import type { Page } from "@playwright/test";

import { expect, hydrated, sizeOf, test } from "./fixtures";
import { resetLayout } from "./map-store";
import { box, reveal } from "./roles-page";

export const stage = async (page: Page) => {
  await reveal(page, "Sales Associate");
  await box(page, "Mark sold out", "Sales Associate").uncheck();
};
export const fold = (page: Page) => reveal(page, "Educator");
export const rack = async (page: Page) => {
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("dialog", { name: "Add to the map" }).getByRole("button", { name: "Frame rack", exact: true }).click();
  if (sizeOf(test.info()) === "phone") await page.getByRole("region", { name: "Selected" }).getByRole("button", { name: "Expand" }).click();
};
export const run = async (page: Page) => {
  await rack(page);
  await page.getByRole("button", { name: "Add rack to the right", exact: true }).filter({ visible: true }).click();
  await expect(page.getByText("Run of 2 racks").filter({ visible: true })).toBeVisible();
};
export const more = async (page: Page) => {
  await rack(page);
  await page.getByRole("button", { name: "Select more", exact: true }).filter({ visible: true }).click();
};
export const corner = async (page: Page) => {
  await resetLayout();
  await page.goto("/layout/edit");
  await hydrated(page);
  await page.getByRole("button", { name: "Store outline" }).click();
  const at = (await page.getByRole("img", { name: /^Store layout:/ }).boundingBox())!;
  await page.mouse.click(at.x + at.width * 0.3, at.y + at.height * 0.4);
};

// 0.7.0 (plan task 12): every control on the new screens that shows only an icon names itself, to a screen
// reader (aria-label) and, on hover, to a mouse (the tooltip a `Button icon` adds from the same label).
const iconOnly = (page: Page) =>
  page.locator("button:visible, a[href]:visible, [role=menuitem]:visible").evaluateAll((els) =>
    els
      .filter((e) => !(e as HTMLElement).innerText.trim())
      .map((e) => ({ label: e.getAttribute("aria-label"), html: e.outerHTML.slice(0, 100) })),
  );

export async function expectIconsNamed(page: Page) {
  for (const control of await iconOnly(page)) expect(control.label, control.html).toBeTruthy();
}
