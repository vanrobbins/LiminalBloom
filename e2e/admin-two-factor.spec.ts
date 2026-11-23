// Two-step sign-in for Liminal Bloom admins (0.7.1a, A10, spec 15): an admin without it is sent to set it up,
// the setup runs through the screens, sign-in then asks for a code (or a backup code, once), and a session whose
// code is older than 12 hours is sent to /admin/verify. Each test makes an admin of its own (admin-account.ts), so
// an aged session or a locked-out account never reaches another spec. Codes come from e2e/totp.ts.

import type { Page } from "@playwright/test";

import { adminWithTwoFactor, ageTwoFactor, clearAdmins, newAdminAccount } from "./admin-account";
import { expect, hydrated, test } from "./fixtures";
import { totp, wrongCode } from "./totp";
import { freshAddress, signInToCodePage, submitCode } from "./two-factor-screens";

// A refused code is a 4xx to the browser, which logs it.
test.use({ allowedConsoleError: /40[0-9]|Failed to load resource/ });
test.setTimeout(90_000);
test.afterEach(clearAdmins);

const WRONG = "That code didn't work. Try the newest one.";
const overview = (page: Page) => expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
const verify = (page: Page, code: string) => page.getByLabel("Code from your authenticator app").fill(code).then(() => page.getByRole("button", { name: "Verify", exact: true }).click());

/** Signs out (the cookies go) and starts a new sign-in at /admin from a new address, to the code page. */
async function signInAgain({ context, page, email, password }: { context: Awaited<ReturnType<typeof newAdminAccount>>["context"]; page: Page; email: string; password: string }) {
  await context.clearCookies();
  await freshAddress(context);
  await signInToCodePage(page, email, password, "/admin");
}

test("an admin without two-step sign-in is sent to set it up, refused a wrong password and a wrong code, then gets in", async ({ browser }, testInfo) => {
  const { context, page, password } = await newAdminAccount(browser, testInfo);
  try {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/two-factor$/);
    await page.goto("/admin/verify");
    await expect(page).toHaveURL(/\/admin\/two-factor$/);
    await hydrated(page);

    await page.getByLabel("Password", { exact: true }).fill("not-my-password");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.locator('p[role="alert"]')).toHaveText("That isn't your password.");

    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Continue" }).click();
    const key = page.locator('section[aria-labelledby="setup-key"] code');
    await expect(key).toBeVisible();
    const secret = ((await key.textContent()) ?? "").replace(/\s/g, "");
    const turnOn = page.getByRole("button", { name: "Turn on two-step sign-in", exact: true });
    await expect(turnOn).toBeDisabled();
    await page.getByLabel("I saved these codes somewhere safe.").check();
    await page.getByLabel("Code from your authenticator app").fill(wrongCode(secret));
    await turnOn.click();
    await expect(page.locator('p[role="alert"]')).toHaveText(WRONG);
    await expect(page).toHaveURL(/\/admin\/two-factor$/);

    await page.getByLabel("Code from your authenticator app").fill(totp(secret));
    await turnOn.click();
    await page.waitForURL("**/admin");
    await overview(page);
  } finally {
    await context.close();
  }
});

test("setup through the screens, then a new sign-in asks for the code: a wrong one is refused, the right one opens /admin", async ({ browser }, testInfo) => {
  const admin = await adminWithTwoFactor(browser, testInfo);
  try {
    await overview(admin.page);
    await signInAgain(admin);
    await submitCode(admin.page, wrongCode(admin.secret));
    await expect(admin.page.locator('p[role="alert"]')).toHaveText(WRONG);
    await expect(admin.page).toHaveURL(/\/sign-in\/two-factor/);
    await submitCode(admin.page, totp(admin.secret));
    await admin.page.waitForURL("**/admin");
    await overview(admin.page);
  } finally {
    await admin.context.close();
  }
});

test("a backup code signs in once, and a second try with it is refused", async ({ browser }, testInfo) => {
  const admin = await adminWithTwoFactor(browser, testInfo);
  const { page, backupCodes } = admin;
  try {
    await signInAgain(admin);
    await submitCode(page, backupCodes[0], { backup: true });
    await page.waitForURL("**/admin");
    await overview(page);

    await signInAgain(admin);
    await submitCode(page, backupCodes[0], { backup: true });
    await expect(page.locator('p[role="alert"]')).toHaveText("That backup code didn't work. Each one works only once.");
    // Another one still works.
    await page.getByLabel("Backup code").fill(backupCodes[1]);
    await page.getByRole("button", { name: "Verify", exact: true }).click();
    await page.waitForURL("**/admin");
  } finally {
    await admin.context.close();
  }
});

test("after 12 hours /admin asks for a code again: a wrong one is refused, the right one opens it, and 11 hours is still fresh", async ({ browser }, testInfo) => {
  const { context, page, email, secret } = await adminWithTwoFactor(browser, testInfo);
  try {
    await overview(page);
    await ageTwoFactor(email, 13);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/verify$/);
    await hydrated(page);
    await expect(page.getByRole("heading", { name: "Confirm it's you" })).toBeVisible();

    await verify(page, wrongCode(secret));
    await expect(page.locator('p[role="alert"]')).toHaveText(WRONG);
    await verify(page, totp(secret));
    await page.waitForURL("**/admin");
    await overview(page);

    await ageTwoFactor(email, 11);
    await page.goto("/admin/people");
    await expect(page).toHaveURL(/\/admin\/people$/);
  } finally {
    await context.close();
  }
});

test("five wrong codes at the step-up lock it: even the right code is refused after that", async ({ browser }, testInfo) => {
  const { context, page, email, secret } = await adminWithTwoFactor(browser, testInfo);
  try {
    await ageTwoFactor(email, 13);
    await page.goto("/admin/verify");
    await hydrated(page);
    for (let attempt = 0; attempt < 5; attempt++) {
      await verify(page, wrongCode(secret));
      await expect(page.getByRole("button", { name: "Verify", exact: true })).toBeEnabled();
    }
    await expect(page.locator('p[role="alert"]')).toHaveText(WRONG);
    await verify(page, totp(secret));
    await expect(page.locator('p[role="alert"]')).toHaveText("Too many tries. Try again in a few minutes.");
    await expect(page).toHaveURL(/\/admin\/verify$/);
  } finally {
    await context.close();
  }
});
