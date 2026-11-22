// The People screen as a Store Manager (spec 0.7, 4.8 part 9). The test account is
// the Store Manager of its home store; the rest of the team is written to the
// database (people-store.ts) and cannot sign in; what each role sees on this
// screen is in access-managers.spec.ts and access-staff.spec.ts, which sign in as one account per role.

import type { Page } from "@playwright/test";

import { expect, hydrated, sizeOf, test } from "./fixtures";
import { clearPeople, emailOf, loggedEvents, removeBehindTheScenes, seedInvitation, seedTeam, setRoleBehindTheScenes } from "./people-store";

test.beforeEach(async () => {
  await seedTeam();
});
test.afterEach(async () => {
  await clearPeople();
});

const mainNav = (page: Page) => page.locator("nav[data-nav]").filter({ visible: true });
// The role groups only: the panel also has a "Store details" heading.
const groups = async (page: Page) => (await page.locator("main h2").allTextContents()).filter((h) => h.includes(" · "));

async function openPeople(page: Page) {
  await page.goto("/store");
  await hydrated(page);
  await expect(page.getByRole("heading", { level: 1, name: "Store" })).toBeVisible();
}

test("is in the navigation for this width, as the current page, and the groups run highest rank first", async ({ page }) => {
  await openPeople(page);
  // The nav entry is renamed Store and checked as current in task 4 (0.7.0.7); until then it still reads People.
  await expect(mainNav(page).getByRole("link", { name: "People" })).toBeVisible();
  expect(await groups(page)).toEqual([
    "Store Manager · 2",
    "Assistant Manager · 1",
    "Visual Merchandising Manager · 1",
    "Visual Merchandising Worker · 1",
    "Sales Associate · 2",
  ]);
  const sales = page.getByRole("listitem").filter({ hasText: /Sales/ });
  await expect(sales.first()).toContainText("Abe Sales");
  await expect(sales.last()).toContainText("Zoe Sales");
  await expect(page.getByText("(you)")).toHaveCount(1);
});

test("shows a Store Manager every address, and buttons only below Store Manager, never on themselves", async ({ page }) => {
  await openPeople(page);
  await expect(page.getByText(emailOf("Zoe Sales"))).toBeVisible();
  await expect(page.getByText(emailOf("Sue Manager"))).toBeVisible();
  for (const name of ["Ann Assistant", "Vic Manager", "Wes Worker", "Zoe Sales", "Abe Sales"]) {
    await expect(page.getByRole("button", { name: `Change role for ${name}` })).toBeVisible();
    await expect(page.getByRole("button", { name: `Remove ${name}` })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: /Change role for Sue/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Remove Sue/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Change role for / })).toHaveCount(5);
  await expect(page.getByText("A store always keeps one Store Manager.")).toHaveCount(0);
});

test("keeps every row button at least 44 px, inside the screen, with no sideways scroll", async ({ page }) => {
  await openPeople(page);
  const viewport = page.viewportSize()!;
  for (const button of await page.getByRole("button", { name: /^(Change role for|Remove) / }).all()) {
    const box = (await button.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(43.5);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 0.5);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("keeps five phone tabs of 44 px or more at 320 px wide", async ({ page }, testInfo) => {
  test.skip(sizeOf(testInfo) !== "phone", "The tab bar is a phone form.");
  await page.setViewportSize({ width: 320, height: 640 });
  await openPeople(page);
  const links = await mainNav(page).getByRole("link").all();
  expect(links).toHaveLength(5);
  for (const link of links) expect((await link.boundingBox())!.width).toBeGreaterThanOrEqual(44);
  await expect(mainNav(page).getByRole("link", { name: "People" })).toBeVisible();
});

test("changes a role: only lower roles are offered, the person moves group, the change is logged", async ({ page }) => {
  await openPeople(page);
  await page.getByRole("button", { name: "Change role for Zoe Sales" }).click();
  const dialog = page.getByRole("dialog", { name: "Change Zoe Sales's role" });
  const select = dialog.getByRole("combobox", { name: "Role" });
  await expect(select.locator("option")).toHaveText(["Assistant Manager", "Visual Merchandising Manager", "Visual Merchandising Worker", "Sales Associate"]);
  await expect(dialog.getByRole("button", { name: "Save role" })).toBeDisabled();
  await select.selectOption({ label: "Visual Merchandising Worker" });
  await dialog.getByRole("button", { name: "Save role" }).click();
  // No toast: the row moves to its new group, and a screen reader hears the change.
  await expect(page.getByRole("status").filter({ hasText: "Changed Zoe Sales to Visual Merchandising Worker" })).toBeAttached();
  await expect(page.getByRole("heading", { name: "Visual Merchandising Worker · 2" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sales Associate · 1" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Change role for Zoe Sales" })).toBeFocused();
  expect((await loggedEvents())[0]).toBe("member_role_changed");
});

test("says a role changed meanwhile, turns Save off, and shows the new list on close", async ({ page }) => {
  await openPeople(page);
  await page.getByRole("button", { name: "Change role for Zoe Sales" }).click();
  const dialog = page.getByRole("dialog", { name: "Change Zoe Sales's role" });
  await setRoleBehindTheScenes("Zoe Sales", "vm_manager");
  await dialog.getByRole("combobox", { name: "Role" }).selectOption({ label: "Visual Merchandising Worker" });
  await dialog.getByRole("button", { name: "Save role" }).click();
  await expect(dialog.getByRole("status")).toHaveText("Zoe Sales's role changed meanwhile. Close and look again.");
  await expect(dialog.getByRole("button", { name: "Save role" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "Visual Merchandising Manager · 2" })).toBeVisible();
  expect(await loggedEvents()).toEqual([]);
});

test("removes someone: confirm words, the row folds away, focus moves to a neighbouring row, the removal is logged", async ({ page }) => {
  await openPeople(page);
  await page.getByRole("button", { name: "Remove Zoe Sales" }).click();
  const dialog = page.getByRole("dialog", { name: "Remove Zoe Sales?" });
  await expect(dialog).toContainText("They lose access to Pioneer Place at once. To bring them back, send a new invitation.");
  await dialog.getByRole("button", { name: "Remove from store" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Removed Zoe Sales" })).toBeAttached();
  await expect(page.getByText("Zoe Sales", { exact: true })).toHaveCount(0);
  // Zoe was last in her group, so focus goes to the row before her (not to the page).
  await expect(page.getByRole("button", { name: "Change role for Abe Sales" })).toBeFocused();
  expect((await loggedEvents())[0]).toBe("member_removed");
});

test("says someone is already gone when they were removed while the dialog was open", async ({ page }) => {
  await openPeople(page);
  await page.getByRole("button", { name: "Remove Abe Sales" }).click();
  const dialog = page.getByRole("dialog", { name: "Remove Abe Sales?" });
  await removeBehindTheScenes("Abe Sales");
  await dialog.getByRole("button", { name: "Remove from store" }).click();
  await expect(dialog.getByRole("status")).toHaveText("Abe Sales isn't in this store anymore. Close and look again.");
  await expect(dialog.getByRole("button", { name: "Remove from store" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(page.getByText("Abe Sales", { exact: true })).toHaveCount(0);
  expect(await loggedEvents()).toEqual([]);
});

test("says so when you are the only person, and that a store keeps one Store Manager", async ({ page }) => {
  await clearPeople();
  await openPeople(page);
  await expect(page.getByText("Only you so far.")).toBeVisible();
  await expect(page.getByText("A store always keeps one Store Manager.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Change role|Remove/ })).toHaveCount(0);
});

test("lists waiting invitations: copy the link, cancel one, no buttons where the rank rule says no", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const jane = await seedInvitation("jane@example.test", "sales_associate");
  await seedInvitation("old@example.test", "sales_associate", true);
  await seedInvitation("boss@example.test", "store_manager");
  await openPeople(page);
  await expect(page.getByRole("heading", { name: "Invitations waiting" })).toBeVisible();
  const row = (email: string) => page.getByRole("listitem").filter({ hasText: email });
  await expect(row("jane@example.test")).toContainText(/Sales Associate role · Expires/);
  await expect(row("old@example.test")).toContainText(/Expired/);
  await expect(page.getByRole("button", { name: "Copy link for old@example.test" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Cancel invitation for old@example.test" })).toBeVisible();
  await expect(row("boss@example.test").getByRole("button")).toHaveCount(0);

  await page.getByRole("button", { name: "Copy link for jane@example.test" }).click();
  // The icon swaps to a check for a moment (no toast), and the link is on the clipboard.
  await expect(page.getByRole("button", { name: "Copy link for jane@example.test" }).locator("[data-copied]")).toHaveClass(/opacity-100/);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`${new URL(page.url()).origin}/invite/${jane}`);

  await page.getByRole("button", { name: "Cancel invitation for jane@example.test" }).click();
  // The row folds shut, then the list reloads without it.
  await expect(page.getByRole("button", { name: "Cancel invitation for jane@example.test" })).toHaveCount(0);
  expect((await loggedEvents())[0]).toBe("invitation_cancelled");
});
