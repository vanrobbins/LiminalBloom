// Tooltips and "What's this?" popovers (Week 6.5 spec §5.4): icon-only buttons
// name themselves on hover and on keyboard focus; ⓘ opens on a tap and closes
// with Escape.

import type { Page } from "@playwright/test";

import { expect, hydrated, sizeOf, test } from "./fixtures";
import { seedLayout } from "./map-store";
import { clearPeople, inviteeEmail, seedInvitation } from "./people-store";
import { seedCatalog } from "./product-store";
import { HOME_STORE, ipFor } from "./test-account";

test.beforeEach(async () => {
  await seedLayout();
  await seedCatalog();
});
test.afterEach(async () => {
  await clearPeople();
});

test("an icon-only button shows its name on hover and on keyboard focus", async ({ page }) => {
  test.skip(sizeOf(test.info()) !== "desktop", "Hover and a keyboard are the desktop's.");
  // Zoom buttons are for screens under 1024 px; a mouse can still be on one.
  await page.setViewportSize({ width: 1000, height: 800 });
  await page.goto("/layout");
  await hydrated(page);
  const zoomIn = page.getByRole("button", { name: "Zoom in" }).filter({ visible: true });
  await zoomIn.hover();
  await expect(page.getByRole("tooltip", { name: "Zoom in" })).toBeVisible();
  // Radix waits for the next move: the pointer may be crossing to the tooltip.
  await page.mouse.move(0, 0);
  await page.mouse.move(5, 5);
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await zoomIn.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("tooltip", { name: "Zoom in" })).toBeVisible();
});

test("a ⓘ opens its explanation on a tap and closes with Escape", async ({ page }) => {
  await page.goto("/planograms");
  await hydrated(page);
  const info = page.getByRole("button", { name: "What's planogram?" }).filter({ visible: true });
  if (test.info().project.use.hasTouch) await info.tap();
  else await info.click();
  await expect(page.getByText("The plan for what goes where on a fixture.", { exact: false })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText("The plan for what goes where on a fixture.", { exact: false })).toBeHidden();
});

// 0.7.0 (plan task 12): every control on the new screens that shows only an icon names itself, to a screen
// reader (aria-label) and, on hover, to a mouse (the tooltip a `Button icon` adds from the same label).
const iconOnly = (page: Page) =>
  page.locator("button:visible, a[href]:visible, [role=menuitem]:visible").evaluateAll((els) =>
    els
      .filter((e) => !(e as HTMLElement).innerText.trim())
      .map((e) => ({ label: e.getAttribute("aria-label"), html: e.outerHTML.slice(0, 100) })),
  );

async function expectIconsNamed(page: Page) {
  for (const control of await iconOnly(page)) expect(control.label, control.html).toBeTruthy();
}

for (const path of ["/people", "/roles", "/account", "/store"]) {
  test(`${path}: every icon-only button has an aria-label`, async ({ page }) => {
    await page.goto(path);
    await hydrated(page);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectIconsNamed(page);
  });
}

test("/people and /roles each have an icon-only button here, and it shows its name on hover", async ({ page }, testInfo) => {
  const size = sizeOf(testInfo);
  // Phone: Invite someone and Add role are icons; from 768 px the row menus on Roles are.
  const named = { "/people": "Invite someone", "/roles": size === "phone" ? "Add role" : "More for Sales Associate" };
  for (const [path, label] of Object.entries(named)) {
    if (path === "/people" && size !== "phone") continue;
    await page.goto(path);
    await hydrated(page);
    const button = page.getByRole("button", { name: label, exact: true }).filter({ visible: true });
    await expect(button).toBeVisible();
    if (size !== "desktop") continue;
    await button.hover();
    await expect(page.getByRole("tooltip", { name: label })).toBeVisible();
    await page.mouse.move(0, 0);
    await page.mouse.move(5, 5);
    await expect(page.getByRole("tooltip")).toHaveCount(0);
  }
});

test("/welcome and /invite/[id]: every icon-only button has an aria-label", async ({ page, browser }) => {
  const email = inviteeEmail();
  const invitation = await seedInvitation(email, "sales_associate");
  const context = await browser.newContext({ viewport: page.viewportSize()!, storageState: { cookies: [], origins: [] }, extraHTTPHeaders: { "x-forwarded-for": ipFor(test.info().parallelIndex) } });
  try {
    const guest = await context.newPage();
    await guest.goto(`/invite/${invitation}`);
    await expect(guest.getByRole("heading", { level: 1 })).toBeVisible();
    await expectIconsNamed(guest);
    // A new account has no store yet: /welcome, with the invitation waiting for its address.
    await guest.goto("/sign-up");
    await hydrated(guest);
    await guest.getByLabel("Name").fill("Icon Checker");
    await guest.getByLabel("Work email").fill(email);
    await guest.getByLabel("Password", { exact: true }).fill("correct-horse-battery");
    await guest.getByRole("button", { name: "Create account" }).click();
    await guest.waitForURL("**/welcome");
    await expect(guest.getByRole("heading", { name: "Invitations for you" })).toBeVisible();
    await expect(guest.getByText(HOME_STORE, { exact: true })).toBeVisible();
    await expectIconsNamed(guest);
    await guest.goto(`/invite/${invitation}`);
    await expect(guest.getByRole("button", { name: "Accept invitation" })).toBeVisible();
    await expectIconsNamed(guest);
  } finally {
    await context.close();
  }
});
