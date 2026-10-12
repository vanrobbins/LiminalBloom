import { expect, hydrated, sizeOf, test } from "./fixtures";
import { seedLayout, seedRack, seedTableSet } from "./map-store";
import { seedCatalog } from "./product-store";

test.beforeEach(async () => {
  await seedLayout();
  await seedCatalog();
});

type Page = import("@playwright/test").Page;

async function openTable(page: Page) {
  await page.goto("/planograms");
  await page.getByRole("link", { name: /Table 1/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Table 1" })).toBeVisible();
  await hydrated(page);
}

async function startDraft(page: Page) {
  await expect(page.getByText("Not published")).toBeVisible();
  await page.getByRole("button", { name: "Start draft" }).click();
  await expect(page.getByRole("button", { name: "Add product" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^E2E High-Rise Pant, / })).toBeVisible();
}

async function publishVersionOne(page: Page) {
  await openTable(page);
  await startDraft(page);
  await page.getByRole("button", { name: "Publish…" }).click();
  await page.getByRole("button", { name: /^Publish to / }).click();
  await expect(page.getByText("Version 1 published", { exact: true })).toBeVisible();
}

async function tapTableOnMap(page: Page) {
  await page.goto("/layout");
  const table = page.locator('[data-fixture-name="Table 1"]').first();
  await expect(table).toBeVisible();
  await hydrated(page);
  const box = (await table.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

async function addTee(page: Page, cell: string) {
  await page.getByRole("button", { name: "Add product" }).click();
  await page.getByLabel("Find a product").fill("E2E Pocket");
  await page.getByRole("button", { name: /E2E Pocket Tee/ }).click();
  await page.getByLabel("Cell").fill(cell);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Saved");
}

async function movePant(page: Page, cell: string) {
  await page.getByRole("button", { name: /^E2E High-Rise Pant, / }).click();
  await page.getByLabel("Cell").fill(cell);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved");
  // On phones the edit sheet stays open and hides the page behind it.
  const sheet = page.getByRole("dialog", { name: "E2E High-Rise Pant" });
  if (await sheet.isVisible()) {
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
  }
}

test("a draft from the floor is edited, published, and Search shows the new cell", async ({ page }) => {
  await openTable(page);
  await startDraft(page);
  await addTee(page, "D1");
  await movePant(page, "A2");
  await expect(page.locator("[data-card]").filter({ hasText: "E2E High-Rise Pant" })).toContainText("A2–B3");

  await page.getByRole("button", { name: "Publish…" }).click();
  await expect(page.getByText("Top: 2 added")).toBeVisible();
  await page.getByLabel("Summary (optional)").fill("E2E reset");
  await page.getByRole("button", { name: /^Publish to / }).click();
  await expect(page.getByText("Version 1 published", { exact: true })).toBeVisible();
  await expect(page.getByText(/Version 1 · published/)).toBeVisible();

  await page.goto("/search?q=E2E-PT-01");
  await expect(page.getByRole("main").getByRole("list").first()).toContainText("Table 1, D1 · Folded");
});

test("history shows the version, and restore makes it the draft", async ({ page }) => {
  await openTable(page);
  await startDraft(page);
  await page.getByRole("button", { name: "Publish…" }).click();
  await page.getByRole("button", { name: /^Publish to / }).click();
  await expect(page.getByText("Version 1 published", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "History" }).click();
  await expect(page.getByRole("heading", { name: "Version 1" })).toBeVisible();
  await hydrated(page);
  await page.getByRole("button", { name: "Restore version 1" }).click();
  await page.getByRole("button", { name: "Restore as draft" }).click();
  await expect(page.getByText("Restored version 1 as a draft.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add product" })).toBeVisible();
});

test("two devices edit one draft and see each other's changes", async ({ page, browser }) => {
  await openTable(page);
  await startDraft(page);
  const other = await browser.newContext();
  try {
    const otherPage = await other.newPage();
    await openTable(otherPage);
    await expect(otherPage.getByRole("button", { name: /^E2E High-Rise Pant, / })).toBeVisible();

    await addTee(page, "D1");
    await movePant(otherPage, "A2");
    // The other device's save reply carried the tee.
    await expect(otherPage.locator("[data-card]").filter({ hasText: "E2E Pocket Tee" })).toBeVisible();
    // Coming back to the first device reloads the draft.
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(page.locator("[data-card]").filter({ hasText: "E2E High-Rise Pant" })).toContainText("A2–B3");
  } finally {
    await other.close();
  }
});

test("a refused placement says why", async ({ page }) => {
  await openTable(page);
  await startDraft(page);
  await page.getByRole("button", { name: "Add product" }).click();
  await page.getByLabel("Find a product").fill("E2E Pocket");
  await page.getByRole("button", { name: /E2E Pocket Tee/ }).click();
  await page.getByLabel("Cell").fill("B1");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Blocked by E2E High-Rise Pant")).toBeVisible();
});

test("Open planogram from Search highlights the product", async ({ page }) => {
  await openTable(page);
  await startDraft(page);
  await page.getByRole("button", { name: "Publish…" }).click();
  await page.getByRole("button", { name: /^Publish to / }).click();
  await expect(page.getByText("Version 1 published", { exact: true })).toBeVisible();

  await page.goto("/search?q=E2E-HRP-01");
  await page.getByRole("main").getByRole("list").first().getByRole("button", { name: /E2E High-Rise Pant/ }).click();
  await page.getByRole("link", { name: "Open planogram" }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/planograms\/[0-9a-f-]+\?product=/);
  await expect(page.getByText(/Version 1 · published/)).toBeVisible();
  await expect(page.locator("[data-placement][data-marked]")).toHaveCount(1);
});

test("the map shows the published planogram and opens it for editing", async ({ page }) => {
  await publishVersionOne(page);
  await tapTableOnMap(page);
  const pant = page.getByRole("button", { name: /^E2E High-Rise Pant, / }).filter({ visible: true });
  await expect(pant).toBeVisible();
  await pant.click();
  await expect(page.getByRole("link", { name: "Find in Search" }).filter({ visible: true })).toBeVisible();
  await tapTableOnMap(page);
  await page.getByRole("link", { name: "Edit planogram" }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/planograms\/[0-9a-f-]{36}/);
});

test("the nav has Planograms", async ({ page }) => {
  await page.goto("/products");
  await page.getByRole("navigation", { name: "Main" }).filter({ visible: true }).getByRole("link", { name: "Planograms" }).click();
  await expect(page).toHaveURL(/\/planograms$/);
});

test("a lower table's id lands on its upper table's planogram", async ({ page }) => {
  const { upperId, lowerId } = await seedTableSet();
  await page.goto(`/planograms/${lowerId}`);
  await expect(page).toHaveURL(new RegExp(`/planograms/${upperId}$`));
  await expect(page.getByRole("heading", { level: 1, name: "Table 1" })).toBeVisible();
});

test("a fixture never published says so, and starts a draft from the bar", async ({ page }) => {
  await openTable(page);
  await expect(page.getByText("No planogram yet")).toBeVisible();
  await page.getByRole("button", { name: "Start draft" }).click();
  await expect(page.getByRole("button", { name: "Add product" })).toBeVisible();
});

test("discarding a draft goes through the ⋯ menu and a confirmation", async ({ page }) => {
  await openTable(page);
  await startDraft(page);
  await page.getByRole("button", { name: "More draft actions" }).click();
  await page.getByRole("menuitem", { name: "Discard draft…" }).click();
  await page.getByRole("dialog", { name: "Discard this draft?" }).getByRole("button", { name: "Discard draft" }).click();
  await expect(page.getByRole("button", { name: "Start draft" })).toBeVisible();
  await expect(page.getByText("No planogram yet")).toBeVisible();
});

test("the due date is set from its chip, and saved only by Save", async ({ page }) => {
  await openTable(page);
  await page.getByRole("button", { name: "Set due date" }).click();
  // The dialog is titled "Due date" too.
  await page.locator("input[type=date]").fill("2099-10-14");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: "Due Oct 14" })).toBeVisible();
});

test("switching faces still lands with reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const { rackId } = await seedRack();
  await page.goto(`/planograms/${rackId}`);
  await hydrated(page);
  // A rack never published shows no grid until a draft starts.
  await page.getByRole("button", { name: "Start draft" }).click();
  await expect(page.getByRole("button", { name: "Add product" })).toBeVisible();
  await page.getByRole("group", { name: "Side" }).getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("button", { name: "Back" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("region", { name: /, Back:/ })).toBeVisible();
});

test("after a face slide with motion on, a grid that fits shows no scroll fade", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const { rackId } = await seedRack();
  await page.goto(`/planograms/${rackId}`);
  await hydrated(page);
  await page.getByRole("button", { name: "Start draft" }).click();
  await expect(page.getByRole("button", { name: "Add product" })).toBeVisible();
  await page.getByRole("group", { name: "Side" }).getByRole("button", { name: "Back" }).click();
  const grid = page.getByRole("region", { name: /, Back:/ });
  await expect(grid).toBeVisible();
  // The slide-in is over once nothing is animating inside the grid.
  await expect.poll(() => grid.evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
  const scroller = grid.locator("> div").first();
  await expect.poll(() => scroller.evaluate((el) => (el.scrollWidth <= el.clientWidth ? getComputedStyle(el).maskImage : "scrolls"))).toBe("none");
});

test("on a phone the sticky action bar never hides the last card", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) >= 768, "The bar is inline on tablet and desktop.");
  await openTable(page);
  await startDraft(page);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const card = await page.locator("[data-card]").last().boundingBox();
  const bar = await page.locator("[data-action-bar]").boundingBox();
  expect(card && bar && card.y + card.height <= bar.y).toBe(true);
});

test("a long fixture name truncates in the phone header without sideways scroll", async ({ page }, testInfo) => {
  test.skip(sizeOf(testInfo) !== "phone", "phone header only");
  const name = "Denim Wall · Bay 3 · Spring Reset North";
  const { rackId: fixtureId } = await seedRack(name);
  await page.goto(`/planograms/${fixtureId}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveAttribute("title", name);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
});
