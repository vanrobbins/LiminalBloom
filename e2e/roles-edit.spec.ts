// More of the Roles screen as a Store Manager (spec 0.7, 4.8 parts 4, 7 and 9): moving custom roles, resetting a
// built-in, deleting with and without people, and that a permission turned off takes effect on that person's
// next action. Roles are put back after every test (roles-store.ts).

import type { Browser, Page } from "@playwright/test";

import { expect, hydrated, test } from "./fixtures";
import { clearPeople, inviteeEmail, loggedEvents, seedInvitation, seedTeam } from "./people-store";
import { act, actionsOf, box, openRoles, reveal, reviewAndSave, roleOrder } from "./roles-page";
import { resetRoles, roleOfPerson, seedCustomRole, seedHolder, seedInvitationTo, setSwitchesBehindTheScenes, storedRoles } from "./roles-store";
import { ipFor } from "./test-account";

test.beforeEach(async () => {
  await seedTeam();
});
test.afterEach(async () => {
  await resetRoles();
  await clearPeople();
});

const WORKER = ["view", "products.stock", "products.sale", "planograms.draft"];
const worker = Number(process.env.TEST_PARALLEL_INDEX ?? 0);

test("moves a custom role past its neighbour, never a built-in, and says which role blocks a move that would not nest", async ({ page }) => {
  await seedCustomRole("Educator", 550, ["view", "products.stock"]);
  await seedCustomRole("Planner", 600, ["view"]);
  await openRoles(page);
  expect(await actionsOf(page, "Sales Associate")).toEqual(["Rename"]);
  await act(page, "Educator", "Move up");
  // No toast: the row just moves, and a screen reader hears it.
  await expect(page.getByRole("status").filter({ hasText: "Moved Educator above Sales Associate" })).toBeAttached();
  await expect.poll(() => roleOrder(page)).toEqual(["Store Manager", "Assistant Manager", "Visual Merchandising Manager", "Visual Merchandising Worker", "Educator", "Sales Associate", "Planner"]);
  expect((await loggedEvents())[0]).toBe("role_reordered");

  // The Planner holds only `view`, so it can't sit above the Sales Associate, who can mark sold out.
  await act(page, "Planner", "Move up");
  await expect(page.getByText("Can't move Planner there").first()).toBeVisible();
  await expect(page.getByText("Planner can't mark products sold out, so Sales Associate can't either.").first()).toBeVisible();
  expect((await storedRoles()).map((r) => r.name).slice(-2)).toEqual(["Sales Associate", "Planner"]);
});

test("offers no Move up to a custom role directly below your own", async ({ page }) => {
  await seedCustomRole("Educator", 150, ["view"]);
  await openRoles(page);
  expect(await actionsOf(page, "Educator")).toEqual(["Rename", "Move down", "Delete"]);
});

test("resets a built-in to its name and permissions, only when it differs", async ({ page }) => {
  await setSwitchesBehindTheScenes("vm_worker", ["view", "products.stock"]);
  await openRoles(page);
  expect(await actionsOf(page, "Visual Merchandising Worker")).toEqual(["Rename", "Reset to default"]);
  await act(page, "Visual Merchandising Worker", "Reset to default");
  const dialog = page.getByRole("dialog", { name: "Reset Visual Merchandising Worker?" });
  await expect(dialog).toContainText("Its name goes back to Visual Merchandising Worker and it can again:");
  await expect(dialog).toContainText("Put a product on sale or take it off sale");
  await dialog.getByRole("button", { name: "Reset role" }).click();
  await expect(page.getByText("Reset Visual Merchandising Worker", { exact: true }).first()).toBeVisible();
  expect((await storedRoles()).find((r) => r.name === "Visual Merchandising Worker")!.switches).toEqual(WORKER);
  expect((await loggedEvents())[0]).toBe("role_reset");
  expect(await actionsOf(page, "Visual Merchandising Worker")).toEqual(["Rename"]);
});

test("deletes a role nobody holds after one confirm; a built-in has no Delete", async ({ page }) => {
  await seedCustomRole("Educator", 450, WORKER);
  await openRoles(page);
  expect(await actionsOf(page, "Visual Merchandising Worker")).not.toContain("Delete");
  await act(page, "Educator", "Delete");
  const dialog = page.getByRole("dialog", { name: "Delete Educator?" });
  await expect(dialog).toContainText("This can't be undone.");
  await dialog.getByRole("button", { name: "Delete role" }).click();
  await expect(page.getByText("Deleted Educator").first()).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Roles and permissions" })).toBeFocused();
  await expect.poll(() => roleOrder(page)).not.toContain("Educator");
  expect((await loggedEvents())[0]).toBe("role_deleted");
});

test("a role with people can't be deleted without moving them: they and their invitations move in the same step", async ({ page }) => {
  const educator = await seedCustomRole("Educator", 450, WORKER);
  await seedHolder("Dee Educator", educator);
  await seedInvitationTo("late@example.test", educator);
  await openRoles(page);
  await act(page, "Educator", "Delete");
  const dialog = page.getByRole("dialog", { name: "Delete Educator?" });
  await expect(dialog).toContainText("1 person has this role. Move them to another role first; it happens in the same step.");
  await expect(dialog.getByText("Dee Educator")).toBeVisible();
  await expect(dialog.getByText("1 waiting invitation moves too.")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Delete role" })).toHaveCount(0);
  const where = dialog.getByLabel("Move them to");
  expect(await where.evaluate((s: HTMLSelectElement) => s.selectedOptions[0].text)).toBe("Sales Associate");
  expect(await where.locator("option").allTextContents()).not.toContain("Store Manager");
  await where.selectOption({ label: "Visual Merchandising Worker" });

  // Someone else joins the role while the dialog is open: nothing is moved, the list refreshes in place.
  await seedHolder("Eli Educator", educator);
  await dialog.getByRole("button", { name: "Move 2 people and delete" }).click();
  await expect(dialog.getByRole("status")).toHaveText("Someone joined or left this role meanwhile. Check the list.");
  await expect(dialog.getByText("Eli Educator")).toBeVisible();
  expect(await roleOfPerson("Dee Educator")).toBe("Educator");

  await dialog.getByRole("button", { name: "Move 3 people and delete" }).click();
  await expect(page.getByText("Moved 2 people and 1 waiting invitation to Visual Merchandising Worker and deleted Educator").first()).toBeVisible();
  expect(await roleOfPerson("Dee Educator")).toBe("Visual Merchandising Worker");
  expect(await roleOfPerson("Eli Educator")).toBe("Visual Merchandising Worker");
  expect((await storedRoles()).map((r) => r.name)).not.toContain("Educator");
  const events = await loggedEvents();
  expect(events.filter((e) => e === "member_role_changed")).toHaveLength(2);
  // Written by one statement, so they share a time and their order is not defined.
  expect(events).toContain("role_deleted");
  await expect(page.getByRole("heading", { level: 1, name: "Roles and permissions" })).toBeFocused();
});

/** A browser with nobody signed in, the size of this test's page. */
async function visitor(browser: Browser, page: Page) {
  const context = await browser.newContext({ viewport: page.viewportSize()!, storageState: { cookies: [], origins: [] }, extraHTTPHeaders: { "x-forwarded-for": ipFor(worker) } });
  return { context, page: await context.newPage() };
}

test("a permission turned off takes effect on that person's next action, and their next page load", async ({ page, browser }) => {
  const email = inviteeEmail();
  const invitation = await seedInvitation(email, "assistant_manager");
  const guest = await visitor(browser, page);
  await guest.page.goto("/sign-up");
  await hydrated(guest.page);
  await guest.page.getByLabel("Name").fill("Ari Assistant");
  await guest.page.getByLabel("Work email").fill(email);
  await guest.page.getByLabel("Password", { exact: true }).fill("correct-horse-battery");
  await guest.page.getByRole("button", { name: "Create account" }).click();
  await guest.page.waitForURL("**/welcome");
  await guest.page.goto(`/invite/${invitation}`);
  await guest.page.getByRole("button", { name: "Accept invitation" }).click();
  await guest.page.waitForURL("**/products");
  await openRoles(guest.page);
  await reveal(guest.page, "Sales Associate");
  await expect(box(guest.page, "Run sales", "Sales Associate")).toBeEnabled();
  // Assistant Managers can't change the Store Manager or their own role.
  await reveal(guest.page, "Assistant Manager");
  await expect(box(guest.page, "Run sales", "Assistant Manager")).toBeDisabled();

  // The Store Manager takes Manage roles away from Assistant Managers.
  await openRoles(page);
  await reveal(page, "Assistant Manager");
  await box(page, "Manage roles", "Assistant Manager").uncheck();
  const dialog = await reviewAndSave(page, "Save changes to 1 role?");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved changes to 1 role").first()).toBeVisible();

  // Ari's page is still open. The next thing Ari does is refused by the server, and the next page load is /no-access.
  await act(guest.page, "Sales Associate", "Rename");
  const rename = guest.page.getByRole("dialog", { name: "Rename Sales Associate" });
  await rename.getByLabel("Name").fill("Educator");
  await rename.getByRole("button", { name: "Save name" }).click();
  await expect(rename.getByRole("status")).toHaveText("Your role can't do this anymore.");
  expect((await storedRoles()).map((r) => r.name)).toContain("Sales Associate");
  await guest.page.goto("/roles");
  await expect(guest.page).toHaveURL(/\/no-access$/);
  await guest.context.close();
});
