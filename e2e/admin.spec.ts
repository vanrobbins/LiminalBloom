// The Liminal Bloom admin area opens and reads at phone, tablet and desktop (0.7.1a, A4). The admin is made in
// the database with a fresh code (admin-account.ts, temporary until A10's real two-factor flow); the pages
// read the development database, so the specs look at what the worker accounts' stores already give them.
// Help actions, pausing and the admins page are specced with their own tasks (A5, A6, A8).

import type { Page } from "@playwright/test";

import { adminContext, clearAdmins } from "./admin-account";
import { expect, hydrated, sizeOf, test } from "./fixtures";
import { HOME_STORE, TEST_ACCOUNT } from "./test-account";

const PAGES = ["/admin", "/admin/people", "/admin/stores", "/admin/activity"];

test.describe("a non-admin", () => {
  // A 404 is the point; the browser logs it as a failed resource.
  test.use({ allowedConsoleError: /404|Failed to load resource/ });
  test("gets a 404 for /admin and its pages, with no admin chrome", async ({ page }) => {
    for (const path of ["/admin", "/admin/people", "/admin/stores", "/admin/activity"]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(404);
      await expect(page.getByText("Liminal Bloom admin")).toHaveCount(0);
    }
  });
});

test.describe("a signed-in admin", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  let page: Page;
  const pageErrors: string[] = [];

  test.beforeAll(async ({ browser }, testInfo) => {
    const admin = await adminContext(browser, testInfo);
    page = admin.page;
    page.on("pageerror", (error) => pageErrors.push(error.message));
  });
  test.afterAll(async () => {
    await page?.context().close();
    await clearAdmins();
  });
  test.afterEach(() => {
    expect(pageErrors, "uncaught exceptions").toEqual([]);
  });

  for (const path of PAGES) {
    test(`${path} opens: one h1, controls of 44 px, nothing scrolls sideways`, async () => {
      await page.goto(path);
      await hydrated(page);
      await page.waitForLoadState("networkidle");
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      const tooSmall = await page.locator("button:visible, a:visible, input:visible, select:visible").evaluateAll((elements) =>
        elements
          .filter((element) => element.getRootNode() === document)
          .filter((element) => element.getBoundingClientRect().width > 1)
          .map((element) => ({ control: element.getAttribute("aria-label") || element.textContent?.trim() || element.tagName, height: Math.round(element.getBoundingClientRect().height) }))
          .filter(({ height }) => height < 44),
      );
      expect.soft(tooSmall, "controls under 44 px").toEqual([]);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, "sideways scroll").toBe(0);
    });
  }

  test("the overview shows help waiting and recent activity", async () => {
    await page.goto("/admin");
    await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Help waiting" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recent activity" })).toBeVisible();
  });

  test("the sections are reachable in this size's own menu: sheet, dropdown or sidebar", async ({}, testInfo) => {
    await page.goto("/admin");
    await hydrated(page);
    const size = sizeOf(testInfo);
    if (size === "desktop") {
      await expect(page.getByRole("navigation", { name: "Admin sections" }).filter({ visible: true })).toBeVisible();
      await page.getByRole("navigation", { name: "Admin sections" }).getByRole("link", { name: "Stores" }).click();
    } else {
      await page.getByRole("button", { name: "Menu" }).filter({ visible: true }).click();
      await (size === "phone" ? page.getByRole("dialog").getByRole("link", { name: "Stores" }) : page.getByRole("menuitem", { name: "Stores" })).click();
    }
    await expect(page).toHaveURL(/\/admin\/stores$/);
    await expect(page.getByRole("heading", { level: 1, name: "Stores" })).toBeVisible();
  });

  test("Stores lists the stores, and a store opens with its people and their emails", async () => {
    await page.goto("/admin/stores");
    // Every worker's account has a store of this name, so which one is first is not known: any will do.
    const link = page.getByRole("link", { name: HOME_STORE, exact: true }).filter({ visible: true }).first();
    await expect(link).toBeVisible();
    await link.click();
    await expect(page.getByRole("heading", { level: 1, name: HOME_STORE })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "People" })).toBeVisible();
    await expect(page.locator("#content").getByRole("link", { name: /@/ }).first()).toBeVisible();
  });

  test("People finds an account by email and links to its stores", async () => {
    await page.goto("/admin/people");
    await hydrated(page);
    await page.getByLabel("Email").fill(TEST_ACCOUNT.email.toUpperCase());
    await page.getByRole("button", { name: "Look up" }).click();
    await expect(page).toHaveURL(/\/admin\/people\?email=/);
    await expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: HOME_STORE, exact: true })).toBeVisible();

    await page.getByLabel("Email").fill("nobody-has-this@example.test");
    await page.getByRole("button", { name: "Look up" }).click();
    await expect(page.getByText("No account has that email.")).toBeVisible();
  });

  test("Activity filters by kind and keeps the kind in the address", async () => {
    await page.goto("/admin/activity");
    await hydrated(page);
    await page.getByLabel("Kind").selectOption("store_paused");
    await page.getByRole("button", { name: "Filter" }).click();
    await expect(page).toHaveURL(/kind=store_paused/);
    await expect(page.getByLabel("Kind")).toHaveValue("store_paused");
  });

  test("Back to the app and Sign out are in the menu; signing out ends the session", async ({}, testInfo) => {
    await page.goto("/admin");
    await hydrated(page);
    const size = sizeOf(testInfo);
    if (size === "desktop") {
      await expect(page.getByRole("link", { name: "Back to the app" }).filter({ visible: true })).toHaveAttribute("href", "/home");
      await page.getByRole("button", { name: "Sign out" }).filter({ visible: true }).click();
    } else {
      await page.getByRole("button", { name: "Menu" }).filter({ visible: true }).click();
      await (size === "phone" ? page.getByRole("dialog").getByRole("button", { name: "Sign out" }) : page.getByRole("menuitem", { name: "Sign out" })).click();
    }
    await expect(page).toHaveURL(/\/sign-in/);
    const response = await page.goto("/admin");
    expect(page.url()).toMatch(/\/sign-in/);
    expect(response?.ok()).toBe(true);
  });
});
