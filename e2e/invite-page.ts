// Helpers for invite.spec.ts: the person who was sent a link (a browser with nobody signed in), and the
// Invite dialog and sign-up form they come through.

import type { Browser, Page } from "@playwright/test";

import { expect, hydrated } from "./fixtures";
import { ipFor } from "./test-account";

export const PASSWORD = "correct-horse-battery";
const worker = Number(process.env.TEST_PARALLEL_INDEX ?? 0);

/** A browser with nobody signed in, the size of this test's page: the person who was sent the link. */
export async function visitor(browser: Browser, page: Page) {
  const context = await browser.newContext({ viewport: page.viewportSize()!, storageState: { cookies: [], origins: [] }, extraHTTPHeaders: { "x-forwarded-for": ipFor(worker) } });
  return { context, page: await context.newPage() };
}

export async function openPeople(page: Page) {
  await page.goto("/people");
  await hydrated(page);
  await expect(page.getByRole("heading", { level: 1, name: "People" })).toBeVisible();
}

// Exact: "Role" is also inside "Change role for Ann Assistant".
export const roleField = (page: Page) => page.getByLabel("Role", { exact: true });
export const inviteButton = (page: Page) => page.getByRole("button", { name: /^Invite( someone)?$/ });

/** Makes an invitation through the dialog and returns its link; leaves the dialog on the link. */
export async function invite(page: Page, email: string, role: string) {
  await inviteButton(page).click();
  await page.getByLabel("Email").fill(email);
  await roleField(page).selectOption({ label: role });
  await page.getByRole("button", { name: "Create invite link" }).click();
  return page.getByLabel("Invite link").inputValue();
}

export async function signUp(page: Page, email: string, name = "Nia Invitee") {
  await hydrated(page);
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
}
