// Signing out ends the session on the server. So this test signs in fresh,
// in its own browser context: the saved session every other test shares
// must survive it.

import { expect, test, userMenuButton } from "./fixtures";
import { TEST_ACCOUNT } from "./test-account";

test.use({ storageState: { cookies: [], origins: [] } });

test("signing out ends the session and lands on sign-in", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Work email").fill(TEST_ACCOUNT.email);
  await page.getByLabel("Password", { exact: true }).fill(TEST_ACCOUNT.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/products");

  await userMenuButton(page).click();
  await page
    .getByRole("menuitem", { name: "Sign out" })
    .or(page.getByRole("button", { name: "Sign out" }))
    .filter({ visible: true })
    .click();

  await page.waitForURL("**/sign-in");
  await expect(page.getByText("Signed out.").first()).toBeVisible();

  // Back must not redraw the signed-in page from the client cache: store
  // devices are shared, and the next person would see this one's data.
  await page.goBack();
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByText(TEST_ACCOUNT.email)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Product library" })).toHaveCount(0);

  // The session is gone, not just the page: protected pages send you back.
  await page.goto("/products");
  await expect(page).toHaveURL(/\/sign-in$/);
});
