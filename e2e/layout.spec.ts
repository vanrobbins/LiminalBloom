// Every page, at every size: touch targets are at least 44 px (§5.4) and
// nothing scrolls sideways on a phone. Light only: a theme can't change a size.
// The worker's own pages, then the ones that need someone else: a paused store's
// person (/paused) and a Liminal Bloom admin (/admin and its sections, 0.7.1a).

import type { Page } from "@playwright/test";

import { clearAccounts, newEmail, signUpWithStore } from "./account-store";
import { adminContext } from "./admin-account";
import { expect, test } from "./fixtures";
import { expectLayout } from "./layout-check";
import { sql } from "./map-store";

const PAGES = ["/", "/sign-in", "/sign-up", "/account", "/store", "/home", "/products", "/create-store", "/layout", "/planograms", "/help", "/help/new", "/request-company"];
const ADMIN_PAGES = ["/admin", "/admin/people", "/admin/stores", "/admin/activity", "/admin/admins", "/admin/help", "/admin/requests", "/admin/companies"];

for (const path of PAGES) {
  test.describe(path, () => {
    test("every control is at least 44px tall, and nothing scrolls sideways", async ({ page }) => {
      await expectLayout(page, path);
    });
  });
}

test.describe("/paused", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test.afterEach(clearAccounts);

  test("every control is at least 44px tall, and nothing scrolls sideways", async ({ page }) => {
    const email = newEmail();
    await signUpWithStore(page, email, "Layout Paused Store");
    await sql()`insert into store_suspensions (store_id, reason, suspended_by_name) select m.organization_id, 'e2e layout', 'e2e' from member m join "user" u on u.id = m.user_id where u.email = ${email}`;
    await expectLayout(page, "/paused");
    await expect(page.getByRole("heading", { level: 1, name: "Your store is paused" })).toBeVisible();
  });
});

test.describe("the admin area", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);
  let page: Page;

  test.beforeAll(async ({ browser }, testInfo) => {
    ({ page } = await adminContext(browser, testInfo));
  });
  test.afterAll(async () => {
    await page?.context().close();
  });

  for (const path of ADMIN_PAGES) {
    test(`${path}: every control is at least 44px tall, and nothing scrolls sideways`, async () => {
      await expectLayout(page, path);
    });
  }
});
