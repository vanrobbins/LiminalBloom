// The app shell at each size (§5.2): one navigation form per width, the
// current page marked, stores switched from the shell, and the page never
// hidden behind the phone's tabs.

import {
  expect,
  goldColors,
  sizeOf,
  storeTrigger,
  switchStore,
  test,
  userMenuButton,
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

test("marks the current page, in gold", async ({ page }) => {
  await page.goto("/products");
  const current = mainNav(page).getByRole("link", { name: "Products" });

  await expect(current).toHaveAttribute("aria-current", "page");
  await expect(mainNav(page).getByRole("link", { name: "Account" })).not.toHaveAttribute(
    "aria-current",
    "page",
  );

  const gold = await goldColors(page);
  const used = await current.evaluate((element) => {
    const style = getComputedStyle(element);
    return [style.color, style.backgroundColor, style.borderTopColor];
  });
  expect(used.some((color) => gold.includes(color))).toBe(true);
});

test("moves between Products and Account", async ({ page }) => {
  await page.goto("/products");

  await mainNav(page).getByRole("link", { name: "Account" }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("heading", { level: 1, name: "Account" })).toBeVisible();
  await expect(mainNav(page).getByRole("link", { name: "Account" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  await mainNav(page).getByRole("link", { name: "Products" }).click();
  await expect(page).toHaveURL(/\/products$/);
});

test("switches stores from the shell, there and back", async ({ page }) => {
  await page.goto("/products");
  await expect(storeTrigger(page)).toHaveAttribute("data-store-trigger", HOME_STORE);

  await switchStore(page, SECOND_STORE);
  await expect(page.getByText(`Now working in ${SECOND_STORE}.`).first()).toBeVisible();
  // The second store is empty: the page says so rather than showing a bare list.
  await expect(page.getByText(/No products yet/)).toBeVisible();

  // Leave the account as it started, for the next project.
  await switchStore(page, HOME_STORE);
  await expect(page.locator("[data-status]").first()).toBeVisible();
});

test("the first Tab reaches a skip link that jumps to the page", async ({ page }) => {
  await page.goto("/products");
  await expect(storeTrigger(page)).toBeVisible();

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

test("a store-switch toast sits above the bottom tabs", async ({ page }, testInfo) => {
  test.skip(sizeOf(testInfo) !== "phone", "Only phones have bottom tabs.");
  await page.goto("/products");

  await switchStore(page, SECOND_STORE);
  const toast = page.getByText(`Now working in ${SECOND_STORE}.`).first();
  await expect(toast).toBeVisible();

  const toastBox = (await toast.boundingBox())!;
  const tabs = (await page.locator('nav[data-nav="tabs"]').boundingBox())!;
  expect(toastBox.y + toastBox.height).toBeLessThanOrEqual(tabs.y);

  // Leave the account as it started, for the next project.
  await switchStore(page, HOME_STORE);
});

test("the corner theme toggle is only on pages without the shell", async ({ page }) => {
  const corner = page.getByRole("button", { name: /^Switch to (light|dark)$/ });

  await page.goto("/products");
  await expect(storeTrigger(page)).toBeVisible();
  await expect(corner).toHaveCount(0);

  await page.goto("/");
  await expect(corner).toBeVisible();
});

test("the account menu switches the theme", async ({ page }) => {
  await page.goto("/products");
  const isDark = () => page.evaluate(() => document.documentElement.classList.contains("dark"));
  const before = await isDark();

  await userMenuButton(page).click();
  const name = /^Switch to (light|dark) theme$/;
  await page
    .getByRole("menuitem", { name })
    .or(page.getByRole("button", { name }))
    .filter({ visible: true })
    .click();

  await expect.poll(isDark).toBe(!before);
});

test("create-store offers a way back to members", async ({ page }) => {
  await page.goto("/create-store");
  await expect(page.getByRole("link", { name: "Back to products" })).toHaveAttribute(
    "href",
    "/products",
  );
});
