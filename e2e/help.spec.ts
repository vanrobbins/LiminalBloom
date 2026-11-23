// Help for the signed-in requester (0.7.1a, A7): ask from /help, see the request listed, and see Liminal Bloom's
// reply as a dot and a count that clear once the thread is opened. A10 adds the admin side (the real reply).
// The worker's own account asks; its requests are removed after each test so the five-open limit never bites.
// An admin's reply is written straight to the development database, as the rest of the e2e setup does.

import { adminContext, clearAdmins } from "./admin-account";
import { sql } from "./map-store";
import { expect, hydrated, test } from "./fixtures";
import { TEST_ACCOUNT } from "./test-account";

const MESSAGE = "e2e help: my planogram will not open";

const asker = () => sql()`select id from "user" where email = ${TEST_ACCOUNT.email}`.then((rows) => rows[0].id as string);

test.afterEach(async () => {
  await sql()`delete from help_requests where requester_id = ${await asker()}`;
});

test("asks from Help and finds the request listed as waiting", async ({ page }) => {
  await page.goto("/help");
  await hydrated(page);
  await expect(page.getByText("You haven't asked Liminal Bloom for help yet.")).toBeVisible();

  await page.locator("#content").getByRole("link", { name: "Ask Liminal Bloom" }).click();
  await page.waitForURL("**/help/new");
  await hydrated(page);
  const send = page.getByRole("button", { name: "Send" });
  await expect(send).toBeDisabled();
  await page.getByRole("radio", { name: "Something isn't working" }).check();
  await page.getByLabel("Message").fill(MESSAGE);
  await send.click();

  // Sending opens the new thread, signed You, still waiting; Help lists it.
  await page.waitForURL(/\/help\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("list", { name: "Messages" }).getByText(MESSAGE)).toBeVisible();
  await expect(page.locator("[data-help-status]")).toHaveText("Waiting");

  await page.goto("/help");
  const row = page.locator("#content").getByRole("link", { name: new RegExp(MESSAGE) });
  await expect(row).toBeVisible();
  await expect(row).toContainText("Something isn't working");
  await expect(row).toContainText("Waiting");
});

test("a reply from Liminal Bloom shows a dot and a count until the thread is opened, and a requester can reply and close", async ({ page }) => {
  const id = await asker();
  const [{ id: request }] = await sql()`insert into help_requests (requester_id, kind, context) values (${id}, 'other', '{"state":"member"}'::jsonb) returning id`;
  await sql()`insert into help_messages (request_id, author_id, author_name, from_admin, body) values (${request}, ${id}, 'Acct Tester', false, ${MESSAGE})`;
  await sql()`insert into help_messages (request_id, author_id, author_name, from_admin, body) values (${request}, null, 'Some Admin', true, 'Try again now.')`;
  await sql()`update help_requests set status = 'answered', updated_at = now() where id = ${request}`;

  await page.goto("/help");
  await hydrated(page);
  await expect(page.locator("[data-help-dot]:visible")).toHaveCount(1);
  await expect(page.locator("[data-help-unread]")).toHaveText("New reply");

  await page.locator("#content").getByRole("link", { name: new RegExp(MESSAGE) }).click();
  await page.waitForURL(`**/help/${request}`);
  const thread = page.getByRole("list", { name: "Messages" });
  await expect(thread.getByText("Liminal Bloom", { exact: true })).toBeVisible();
  await expect(thread.getByText("Some Admin")).toHaveCount(0);
  // Opening the thread marks the reply seen and refreshes, so the dot goes.
  await expect(page.locator("[data-help-dot]")).toHaveCount(0);

  await page.getByLabel("Reply").fill("Still stuck, here is more detail");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(thread.getByText("Still stuck, here is more detail")).toBeVisible();
  await expect(page.locator("[data-help-status]")).toHaveText("Waiting");

  await page.getByRole("button", { name: "Close request" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Close request" }).click();
  await expect(page.getByText("Closed. Ask again if you still need help.")).toBeVisible();
  await expect(page.getByLabel("Reply")).toHaveCount(0);
});

test("an admin opens the request, replies, and the requester sees Liminal Bloom and never the admin's name", async ({ browser, page }, testInfo) => {
  const id = await asker();
  const [{ id: request }] = await sql()`insert into help_requests (requester_id, kind, context) values (${id}, 'other', '{"state":"member","role":"Sales Associate"}'::jsonb) returning id`;
  await sql()`insert into help_messages (request_id, author_id, author_name, from_admin, body) values (${request}, ${id}, 'Acct Tester', false, ${MESSAGE})`;

  const admin = await adminContext(browser, testInfo);
  try {
    await admin.page.goto("/admin/help");
    await hydrated(admin.page);
    await admin.page.getByRole("link", { name: new RegExp(MESSAGE) }).click();
    await admin.page.waitForURL(`**/admin/help/${request}`);
    await hydrated(admin.page);
    await expect(admin.page.getByRole("heading", { name: "Context" })).toBeVisible();
    await expect(admin.page.getByText("Sales Associate")).toBeVisible();

    await admin.page.getByLabel("Reply").fill("Try signing in again now.");
    await admin.page.getByRole("button", { name: "Send reply" }).click();
    await expect(admin.page.locator("[data-help-status]")).toHaveText("Replied");
    await expect(admin.page.getByRole("list", { name: "Messages" }).getByText("Ada Admin")).toBeVisible();
  } finally {
    await admin.context.close();
    await clearAdmins();
  }

  await page.goto(`/help/${request}`);
  await hydrated(page);
  const thread = page.getByRole("list", { name: "Messages" });
  await expect(thread.getByText("Try signing in again now.")).toBeVisible();
  await expect(thread.getByText("Liminal Bloom", { exact: true })).toBeVisible();
  await expect(page.getByText("Ada Admin")).toHaveCount(0);
});
