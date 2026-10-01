// Signs in once and saves the session for every other project. Also makes
// sure the account has a second store, and ends on the home store.

import { expect, test as setup } from "@playwright/test";

import { storeChoice, storeTrigger, switchStore } from "./fixtures";
import { AUTH_FILE, HOME_STORE, SECOND_STORE, TEST_ACCOUNT } from "./test-account";

setup("sign in with two stores, working in the home store", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Work email").fill(TEST_ACCOUNT.email);
  await page.getByLabel("Password", { exact: true }).fill(TEST_ACCOUNT.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/products");

  // count() does not wait, so wait for the open menu before asking what is
  // in it -- otherwise every run sees zero stores and creates another.
  await storeTrigger(page).click();
  await expect(storeChoice(page, HOME_STORE)).toBeVisible();
  const hasSecondStore = (await storeChoice(page, SECOND_STORE).count()) > 0;
  await page.keyboard.press("Escape");

  if (!hasSecondStore) {
    await page.goto("/create-store");
    await page.getByLabel("Store name").fill(SECOND_STORE);
    await page.getByRole("button", { name: "Create store" }).click();
    await page.waitForURL("**/products");
  }

  if ((await storeTrigger(page).getAttribute("data-store-trigger")) !== HOME_STORE) {
    await switchStore(page, HOME_STORE);
  }

  await page.context().storageState({ path: AUTH_FILE });
});
