// Invitations (spec 0.7, 4.8 parts 1 and 5, 4.9): the Store Manager makes a link, the invited person
// signs up from it, accepts, and is in the store with that role; also the dialog's refusals, the
// invitation page's messages and /welcome. The test account is its home store's Store Manager;
// joiners are real @example.test sign-ups (clearPeople removes them).

import type { Browser, Page } from "@playwright/test";

import { expect, hydrated, sizeOf, test } from "./fixtures";
import { clearPeople, emailOf, inviteeEmail, loggedEvents, seedInvitation, seedTeam, setInvitationStatus } from "./people-store";
import { HOME_STORE, ipFor, TEST_ACCOUNT } from "./test-account";

test.beforeEach(async () => {
  await seedTeam();
});
test.afterEach(async () => {
  await clearPeople();
});

const PASSWORD = "correct-horse-battery";
const worker = Number(process.env.TEST_PARALLEL_INDEX ?? 0);

/** A browser with nobody signed in, the size of this test's page: the person who was sent the link. */
async function visitor(browser: Browser, page: Page) {
  const context = await browser.newContext({ viewport: page.viewportSize()!, storageState: { cookies: [], origins: [] }, extraHTTPHeaders: { "x-forwarded-for": ipFor(worker) } });
  return { context, page: await context.newPage() };
}

async function openPeople(page: Page) {
  await page.goto("/people");
  await hydrated(page);
  await expect(page.getByRole("heading", { level: 1, name: "People" })).toBeVisible();
}

// Exact: "Role" is also inside "Change role for Ann Assistant".
const roleField = (page: Page) => page.getByLabel("Role", { exact: true });
const inviteButton = (page: Page) => page.getByRole("button", { name: /^Invite( someone)?$/ });

/** Makes an invitation through the dialog and returns its link; leaves the dialog on the link. */
async function invite(page: Page, email: string, role: string) {
  await inviteButton(page).click();
  await page.getByLabel("Email").fill(email);
  await roleField(page).selectOption({ label: role });
  await page.getByRole("button", { name: "Create invite link" }).click();
  return page.getByLabel("Invite link").inputValue();
}

async function signUp(page: Page, email: string, name = "Nia Invitee") {
  await hydrated(page);
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
}

test("invite, sign up from the link, accept: lands in the store with that role and is on People", async ({ page, browser }) => {
  const email = inviteeEmail();
  await openPeople(page);
  const link = await invite(page, email, "Visual Merchandising Worker");
  expect(link).toMatch(/\/invite\/[A-Za-z0-9_-]{32,}$/);
  await expect(page.getByText(/Send this link to .*\. It works until/)).toBeVisible();
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("button", { name: `Copy link for ${email}` })).toBeVisible();

  const guest = await visitor(browser, page);
  await guest.page.goto(link);
  await expect(guest.page.getByRole("heading", { level: 1, name: `Join ${HOME_STORE}` })).toBeVisible();
  await expect(guest.page.getByText("Visual Merchandising Worker").first()).toBeVisible();
  // The address the invitation was sent to is not on the page for a stranger holding the link.
  await expect(guest.page.getByText(email)).toHaveCount(0);

  await guest.page.getByRole("link", { name: "Create an account" }).click();
  await expect(guest.page).toHaveURL(/\/sign-up\?next=%2Finvite%2F/);
  await signUp(guest.page, email);
  // Sign-up returns to the invitation, not to Products.
  await expect(guest.page.getByRole("button", { name: "Accept invitation" })).toBeVisible();
  await expect(guest.page).toHaveURL(link);
  await guest.page.getByRole("button", { name: "Accept invitation" }).click();
  await guest.page.waitForURL("**/products");

  await openPeople(guest.page);
  await expect(guest.page.getByRole("heading", { name: "Visual Merchandising Worker · 2" })).toBeVisible();
  await expect(guest.page.getByRole("listitem").filter({ hasText: "Nia Invitee" })).toContainText("(you)");
  // A Visual Merchandising Worker sees names and roles only, and cannot invite.
  await expect(inviteButton(guest.page)).toHaveCount(0);
  await guest.context.close();

  // The Store Manager sees the invitation used up and the new person in the list, and both events logged.
  await openPeople(page);
  await expect(page.getByRole("button", { name: `Copy link for ${email}` })).toHaveCount(0);
  await expect(page.getByRole("listitem").filter({ hasText: "Nia Invitee" })).toContainText(email);
  expect((await loggedEvents()).slice(0, 2)).toEqual(["invitation_accepted", "invitation_created"]);
});

test("the Invite button is an icon on a phone and labelled from tablet width, and the dialog lists only lower roles", async ({ page }, testInfo) => {
  await openPeople(page);
  if (sizeOf(testInfo) === "phone") {
    const icon = page.getByRole("button", { name: "Invite someone" });
    await expect(icon).toBeVisible();
    expect((await icon.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
    await expect(page.getByRole("button", { name: "Invite", exact: true })).toHaveCount(0);
  } else {
    await expect(page.getByRole("button", { name: "Invite", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Invite someone" })).toHaveCount(0);
  }
  await inviteButton(page).click();
  await expect(page.getByRole("dialog", { name: "Invite someone" })).toBeVisible();
  const options = await roleField(page).locator("option").allTextContents();
  expect(options).toEqual(["Assistant Manager", "Visual Merchandising Manager", "Visual Merchandising Worker", "Sales Associate"]);
  // It starts on the lowest role, the safest one to hand out.
  expect(await roleField(page).evaluate((select: HTMLSelectElement) => select.selectedOptions[0].text)).toBe("Sales Associate");
});

test("refuses in the dialog: no address, someone already in, an invitation already waiting; Done puts focus back on Invite", async ({ page }) => {
  await openPeople(page);
  await inviteButton(page).click();
  await page.getByRole("button", { name: "Create invite link" }).click();
  await expect(page.getByRole("dialog").getByRole("status")).toHaveText("Enter an email address.");

  await page.getByLabel("Email").fill(emailOf("Zoe Sales").toUpperCase());
  await page.getByRole("button", { name: "Create invite link" }).click();
  await expect(page.getByRole("dialog").getByRole("status")).toHaveText("Zoe Sales is already in this store.");

  const email = "waiting.person@example.test";
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Create invite link" }).click();
  await expect(page.getByLabel("Invite link")).toBeVisible();
  const opener = inviteButton(page);
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(opener).toBeFocused();

  await inviteButton(page).click();
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Create invite link" }).click();
  await expect(page.getByRole("dialog").getByRole("status")).toHaveText("An invitation is already waiting for this email. Copy its link or cancel it first.");
  await expect(page.getByLabel("Invite link")).toHaveCount(0);
  expect(await loggedEvents()).toEqual(["invitation_created"]);
});

test("the invitation page says in plain words when a link can't be used", async ({ page, browser }) => {
  const message = async (path: string) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    return page.getByRole("main").innerText();
  };
  expect(await message("/invite/not-a-real-invitation")).toContain("This invitation link isn't valid.");

  const expired = await seedInvitation("expired.person@example.test", "sales_associate", true);
  expect(await message(`/invite/${expired}`)).toContain("This invitation has expired.");

  const other = await seedInvitation("someone.else@example.test", "sales_associate");
  const wrong = await message(`/invite/${other}`);
  expect(wrong).toContain("sent to a different email address");
  expect(wrong).not.toContain("someone.else@example.test");
  await expect(page.getByRole("button", { name: /Accept/ })).toHaveCount(0);

  const cancelled = await seedInvitation("cancelled.person@example.test", "sales_associate");
  await setInvitationStatus(cancelled, "canceled");
  expect(await message(`/invite/${cancelled}`)).toContain("This invitation was cancelled.");
  const used = await seedInvitation("used.person@example.test", "sales_associate");
  await setInvitationStatus(used, "accepted");
  expect(await message(`/invite/${used}`)).toContain("This invitation was already used.");

  const mine = await seedInvitation(TEST_ACCOUNT.email, "sales_associate");
  expect(await message(`/invite/${mine}`)).toContain(`You're already in ${HOME_STORE}.`);

  // Signed out, a stranger with a link is offered sign in and sign up, back to this invitation.
  const guest = await visitor(browser, page);
  await guest.page.goto(`/invite/${other}`);
  await expect(guest.page.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", `/sign-in?next=${encodeURIComponent(`/invite/${other}`)}`);
  await expect(guest.page.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", `/sign-up?next=${encodeURIComponent(`/invite/${other}`)}`);
  await guest.context.close();
});

test("/welcome: a new account sees the invitation waiting for its email by name only, and accepts it from the link", async ({ page, browser }) => {
  const email = inviteeEmail();
  const id = await seedInvitation(email, "sales_associate");
  const guest = await visitor(browser, page);
  await guest.page.goto("/sign-up");
  await signUp(guest.page, email, "Wendy Welcome");
  // No store yet: Products sends them to /welcome, which names the invitation but is no way in: the link is the secret.
  await expect(guest.page).toHaveURL(/\/welcome$/);
  await expect(guest.page.getByRole("heading", { name: "Invitations for you" })).toBeVisible();
  await expect(guest.page.getByText(HOME_STORE, { exact: true })).toBeVisible();
  await expect(guest.page.getByText("Open the invite link you were sent to join.")).toBeVisible();
  await expect(guest.page.getByRole("button", { name: /Accept/ })).toHaveCount(0);
  expect(await guest.page.content()).not.toContain(id);
  await guest.page.goto(`/invite/${id}`);
  await guest.page.getByRole("button", { name: "Accept invitation" }).click();
  await guest.page.waitForURL("**/products");
  await openPeople(guest.page);
  await expect(guest.page.getByRole("heading", { name: "Sales Associate · 3" })).toBeVisible();
  // With a store, /welcome has nothing for them.
  await guest.page.goto("/welcome");
  await expect(guest.page).toHaveURL(/\/products$/);
  await guest.context.close();
  // The Store Manager's own visit goes straight to Products too.
  await page.goto("/welcome");
  await expect(page).toHaveURL(/\/products$/);
});
