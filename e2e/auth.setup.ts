// Signs in once and saves the session for every other project. Also makes
// sure the account has a second store, and ends on the home store.

import { expect, test as setup } from "@playwright/test";

import { storeButton } from "./fixtures";
import { AUTH_FILE, HOME_STORE, SECOND_STORE, TEST_ACCOUNT } from "./test-account";

setup("sign in with two stores, working in the home store", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Work email").fill(TEST_ACCOUNT.email);
  await page.getByLabel("Password", { exact: true }).fill(TEST_ACCOUNT.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/products");
  // count() does not wait, so wait for the switcher before asking what is
  // in it -- otherwise every run sees zero stores and creates another.
  await expect(storeButton(page, HOME_STORE)).toBeVisible();

  if ((await storeButton(page, SECOND_STORE).count()) === 0) {
    await page.goto("/create-store");
    await page.getByLabel("Store name").fill(SECOND_STORE);
    await page.getByRole("button", { name: "Create store" }).click();
    await page.waitForURL("**/products");
  }

  const home = storeButton(page, HOME_STORE);
  if ((await home.getAttribute("data-state")) !== "on") {
    await home.click();
    await expect(home).toHaveAttribute("data-state", "on");
  }

  await page.context().storageState({ path: AUTH_FILE });
});
