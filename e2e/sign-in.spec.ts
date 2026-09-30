import { expect, test } from "./fixtures";
import { TEST_ACCOUNT } from "./test-account";

test.use({
  storageState: { cookies: [], origins: [] },
  // The browser logs the 401 from a rejected sign-in; that is the point here.
  allowedConsoleError: /401|Failed to load resource/,
});

test("a wrong password shows the error next to the form", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Work email").fill(TEST_ACCOUNT.email);
  await page.getByLabel("Password", { exact: true }).fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByText("That email and password do not match.")).toBeVisible();
  await expect(page).toHaveURL(/\/sign-in$/);
});
