import { expect, test } from "./fixtures";

test.use({ storageState: { cookies: [], origins: [] } });

test("the landing page offers sign-in and sign-up", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
  await expect(page.getByRole("link", { name: "Create an account" })).toHaveAttribute(
    "href",
    "/sign-up",
  );
});
