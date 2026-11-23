// The app shell at each size (§5.2): one navigation form per width, the
// current page marked, stores switched from the shell, and the page never
// hidden behind the phone's tabs.

import {
  expect,
  hydrated,
  sizeOf,
  storeChoice,
  storeTrigger,
  switchStore,
  test,
} from "./fixtures";
import { HOME_STORE, SECOND_STORE } from "./test-account";

const NAV_FOR = { phone: "tabs", tablet: "rail", desktop: "sidebar" } as const;

function mainNav(page: import("@playwright/test").Page) {
  return page.locator("nav[data-nav]").filter({ visible: true });
}

test("shows exactly one navigation, the one for this width", async ({ page }, testInfo) => {
  await page.goto("/products");
  await expect(mainNav(page)).toHaveCount(1);

  const shown = await mainNav(page).getAttribute("data-nav");
  expect(shown).toBe(NAV_FOR[sizeOf(testInfo)]);
});

test("moves between Products and Account, which lives in the avatar menu, not the tabs", async ({ page }) => {
  await page.goto("/products");
  await hydrated(page);
  await expect(mainNav(page).getByRole("link", { name: "Account" })).toHaveCount(0);

  await page.locator("[data-user-menu]").filter({ visible: true }).click();
  // A phone's menu is a sheet of links; the dropdown's entries are menu items.
  await page.getByRole("link", { name: "Account" }).or(page.getByRole("menuitem", { name: "Account" })).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("heading", { level: 1, name: "Account" })).toBeVisible();

  await mainNav(page).getByRole("link", { name: "Products" }).click();
  await expect(page).toHaveURL(/\/products$/);
});

test("Home is the first tab, current on /home", async ({ page }) => {
  await page.goto("/home");
  await expect(mainNav(page).getByRole("link").first()).toHaveAccessibleName("Home");
  await expect(mainNav(page).getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
});

test("switches stores from the shell, there and back", async ({ page }) => {
  await page.goto("/products");
  await expect(storeTrigger(page)).toHaveAttribute("data-store-trigger", HOME_STORE);

  await switchStore(page, SECOND_STORE);
  // No toast: the header's store name is the confirmation (switchStore waited for it).
  await expect(page.getByText(`Now working in ${SECOND_STORE}.`)).toHaveCount(0);
  // The second store is empty: the page says so rather than showing a bare list.
  await expect(page.getByText(/No products yet/)).toBeVisible();

  // Leave the account as it started, for the next project.
  await switchStore(page, HOME_STORE);
  await expect(page.locator("[data-status]").first()).toBeVisible();
});

test("every width offers Search as one icon in the page header", async ({ page }) => {
  await page.goto("/products");
  await hydrated(page);
  const search = page.locator("button[aria-keyshortcuts]").filter({ visible: true });
  await expect(search).toHaveCount(1);
  await expect(search).toHaveAccessibleName("Search");
  await expect(page.locator("[data-page-header]").getByRole("button", { name: "Search" })).toBeVisible();
});

test("the first Tab reaches a skip link that jumps to the page", async ({ page }, testInfo) => {
  // A touch screen's Products opens in the search box; with a keyboard it must not.
  await page.goto(sizeOf(testInfo) === "desktop" ? "/products" : "/account");
  await hydrated(page);

  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(page.locator("main#content")).toBeFocused();
});

test("the bottom tabs never cover the last product", async ({ page }, testInfo) => {
  test.skip(sizeOf(testInfo) !== "phone", "Only phones have bottom tabs.");
  await page.goto("/products");

  const last = page.getByRole("main").getByRole("listitem").last();
  await expect(last).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));

  const row = (await last.boundingBox())!;
  const tabs = (await page.locator('nav[data-nav="tabs"]').boundingBox())!;
  expect(row.y + row.height).toBeLessThanOrEqual(tabs.y);
});

test.describe("toast position", () => {
  // The refused request is logged by the browser, on purpose.
  test.use({ allowedConsoleError: /Failed to load resource|Failed to fetch/ });

  test("a toast sits above the bottom tabs (a store switch that can't reach the server)", async ({ page }, testInfo) => {
    test.skip(sizeOf(testInfo) !== "phone", "Only phones have bottom tabs.");
    await page.goto("/products");
    await hydrated(page);
    await page.route("**/set-active", (route) => route.abort());

    await storeTrigger(page).click();
    await storeChoice(page, SECOND_STORE).click();
    const toast = page.getByText("Couldn't switch stores.").first();
    await expect(toast).toBeVisible();

    const toastBox = (await toast.boundingBox())!;
    const tabs = (await page.locator('nav[data-nav="tabs"]').boundingBox())!;
    expect(toastBox.y + toastBox.height).toBeLessThanOrEqual(tabs.y);
  });
});

test("create-store offers a way back to members", async ({ page }) => {
  await page.goto("/create-store");
  await expect(page.getByRole("link", { name: "Back to Home" })).toHaveAttribute(
    "href",
    "/home",
  );
});

test("a phone page has one header and names the store once", async ({ page }, testInfo) => {
  test.skip(sizeOf(testInfo) !== "phone", "phone header only");
  for (const path of ["/products", "/layout", "/planograms", "/account"]) {
    await page.goto(path);
    await expect(page.locator("[data-page-header]").filter({ visible: true })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(storeTrigger(page)).toHaveCount(1);
  }
});
