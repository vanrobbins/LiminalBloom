// "Today" follows the store's time zone (DECISIONS "Time", 10-12). Pago Pago
// (UTC−11) and Kiritimati (UTC+14) are 25 hours apart, so a date that is today
// in Pago Pago is always already past in Kiritimati: overdue flips with the
// store's zone at any hour the test runs.

import { expect, hydrated, test } from "./fixtures";
import { resetStoreZone, seedLayout } from "./map-store";

test.beforeEach(async () => {
  await seedLayout();
});
test.afterEach(async () => {
  await resetStoreZone();
});

const dayIn = (timeZone: string) => new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const shortDay = (iso: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

async function setZone(page: import("@playwright/test").Page, search: string, zone: string) {
  await page.goto("/store");
  await hydrated(page);
  await page.getByRole("button", { name: /^Time zone/ }).click();
  await page.getByRole("combobox", { name: "Find a time zone" }).fill(search);
  // Saved as soon as it is picked: the indicator beside the field says so (no Save button, no toast).
  await page.getByRole("option", { name: zone.replaceAll("_", " "), exact: true }).click();
  // The time zone's indicator is the second on the page (the store name's is the first).
  await expect(page.locator("[data-panel-status]").nth(1)).toHaveText("Saved");
}

test("the store's time zone decides when a due date is overdue", async ({ page }) => {
  const due = dayIn("Pacific/Pago_Pago");
  await setZone(page, "pago", "Pacific/Pago_Pago");

  await page.goto("/planograms");
  await page.getByRole("link", { name: /Table 1/ }).click();
  await hydrated(page);
  await page.getByRole("button", { name: "Start planogram" }).click();
  await page.getByRole("button", { name: "Set due date" }).click();
  await page.locator("input[type=date]").fill(due);
  await expect(page.getByRole("button", { name: `Due ${shortDay(due)}` })).toBeVisible();

  await setZone(page, "kiritimati", "Pacific/Kiritimati");
  await page.goto("/planograms");
  await page.getByRole("link", { name: /Table 1/ }).click();
  await hydrated(page);
  await expect(page.getByRole("button", { name: `Overdue · ${shortDay(due)}` })).toBeVisible();
});

test("Store settings is in the account menu", async ({ page }) => {
  await page.goto("/products");
  await hydrated(page);
  await page.locator("[data-user-menu]").filter({ visible: true }).click();
  await page.locator('a[href="/store"]').filter({ visible: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Store settings" })).toBeVisible();
});
