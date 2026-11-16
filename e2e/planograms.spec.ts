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
  await expect(page.getByText("No planogram yet")).toBeVisible();
  await page.getByRole("button", { name: "Start planogram" }).click();
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

/** The draft's own status line: toasts are role="status" too. */
const saved = (page: Page) => expect(page.locator("[data-draft-status]")).toHaveText("Saved");

/** Add places the tee at the first open spot: Table 1 has the pant at 0-2 ft, so the tee lands at 2-4 ft. */
async function addTee(page: Page) {
  await page.getByRole("button", { name: "Add product" }).click();
  await page.getByLabel("Find a product").fill("E2E Pocket");
  await page.getByRole("button", { name: /E2E Pocket Tee/ }).click();
  await saved(page);
  await expect(page.getByRole("button", { name: "Remove E2E Pocket Tee" })).toBeVisible();
}

async function editNumbers(page: Page, product: string, field: string, value: string) {
  // Select it (another tap on a selected tile would open the panel itself), then the pencil.
  const pencil = page.getByRole("button", { name: `Edit ${product}` });
  if (!(await pencil.isVisible())) await page.getByRole("button", { name: new RegExp(`^${product}, `) }).filter({ visible: true }).click();
  await pencil.click();
  // The numbers save as they change (no Save button): leaving the field sends it.
  await page.getByLabel(field).fill(value);
  await page.getByLabel(field).press("Tab");
}

/** `modal`: the page is phone-sized, where the sheet is a dialog; elsewhere it is a side panel. */
async function closeSheet(page: Page, product: string, modal: boolean) {
  // On phones the edit sheet is a modal dialog that stays open and hides the page behind it.
  if (!modal) return;
  const sheet = page.getByRole("dialog", { name: product });
  await expect(sheet).toBeVisible();
  // Close, not Escape: the "Changed" toast is still up and takes the first Escape.
  await sheet.getByRole("button", { name: "Close" }).click();
  await expect(sheet).toBeHidden();
}

async function movePant(page: Page, fromBack: string, modal: boolean) {
  await editNumbers(page, "E2E High-Rise Pant", "From back (ft)", fromBack);
  // The panel's own line starts empty, so this is this edit's save, not an earlier one's.
  await expect(page.locator("[data-panel-status]")).toHaveText("Saved");
  await saved(page);
  await closeSheet(page, "E2E High-Rise Pant", modal);
}

test("a draft from the floor is edited, published, and Search shows the new cell", async ({ page }, info) => {
  await openTable(page);
  await startDraft(page);
  await addTee(page);
  await movePant(page, "1", sizeOf(info) === "phone");
  await expect(page.locator("[data-card]").filter({ hasText: "E2E High-Rise Pant" })).toContainText("Left · Front");

  // Beside the grid the pant is still selected, with its corner discs on: a tap on empty grid deselects (Table 1 is 6 ft
  // wide; the right 2 ft are empty). On a phone closing the sheet already deselected it, and a tap now would open Add.
  if (sizeOf(info) !== "phone") {
    const block = page.locator("[data-block]").filter({ visible: true }).first();
    const blockBox = await block.boundingBox();
    if (!blockBox) throw new Error("no grid");
    await block.click({ position: { x: blockBox.width - 12, y: blockBox.height / 2 } });
  }
  await expect(page.getByRole("button", { name: "Remove E2E High-Rise Pant" })).toBeHidden();
  await page.getByRole("button", { name: "Publish…" }).click();
  await expect(page.getByText("Top: 2 added")).toBeVisible();
  await page.getByLabel("Summary (optional)").fill("E2E reset");
  await page.getByRole("button", { name: /^Publish to / }).click();
  await expect(page.getByText("Version 1 published", { exact: true })).toBeVisible();
  await expect(page.getByText(/Version 1 · published/)).toBeVisible();

  await page.goto("/products?q=E2E-PT-01");
  await expect(page.getByRole("main").getByRole("list").first()).toContainText("Table 1 · Center · Middle");
  await expect(page.getByRole("main").getByRole("list").first()).toContainText("Folded ·");
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

    await addTee(page);
    await movePant(otherPage, "1", false);
    // The other device's save reply carried the tee.
    await expect(otherPage.locator("[data-card]").filter({ hasText: "E2E Pocket Tee" })).toBeVisible();
    // Coming back to the first device reloads the draft.
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(page.locator("[data-card]").filter({ hasText: "E2E High-Rise Pant" })).toContainText("Left · Front");
  } finally {
    await other.close();
  }
});

test("a refused placement says why", async ({ page }) => {
  await openTable(page);
  await startDraft(page);
  await addTee(page);
  await editNumbers(page, "E2E Pocket Tee", "From left (ft)", "1");
  await expect(page.getByText("Blocked by E2E High-Rise Pant")).toBeVisible();
});

test("Open planogram from Search highlights the product", async ({ page }) => {
  await openTable(page);
  await startDraft(page);
  await page.getByRole("button", { name: "Publish…" }).click();
  await page.getByRole("button", { name: /^Publish to / }).click();
  await expect(page.getByText("Version 1 published", { exact: true })).toBeVisible();

  await page.goto("/products?q=E2E-HRP-01");
  await page.getByRole("main").getByRole("list").first().getByRole("button", { name: /^E2E High-Rise Pant/ }).click();
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
  await expect(page.getByRole("link", { name: "Find in Products" }).filter({ visible: true })).toBeVisible();
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

test("a fixture never published says so, and starts a draft from the empty box", async ({ page }) => {
  await openTable(page);
  await expect(page.getByText("No planogram yet")).toBeVisible();
  await page.getByRole("button", { name: "Start planogram" }).click();
  await expect(page.getByRole("button", { name: "Add product" })).toBeVisible();
});

test("discarding a draft goes through the ⋯ menu and a confirmation; Escape on it puts focus back on the ⋯", async ({ page }) => {
  await openTable(page);
  await startDraft(page);
  const more = page.getByRole("button", { name: "More draft actions" });
  await more.click();
  await page.getByRole("menuitem", { name: "Discard draft…" }).click();
  await expect(page.getByRole("dialog", { name: "Discard this draft?" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Discard this draft?" })).toBeHidden();
  await expect(more).toBeFocused();
  await more.click();
  await page.getByRole("menuitem", { name: "Discard draft…" }).click();
  await page.getByRole("dialog", { name: "Discard this draft?" }).getByRole("button", { name: "Discard draft" }).click();
  await expect(page.getByRole("button", { name: "Start planogram" })).toBeVisible();
  await expect(page.getByText("No planogram yet")).toBeVisible();
});

test("the due date is set from its chip, and saved only by Save", async ({ page }) => {
  await openTable(page);
  // Nothing to be due until a draft exists (UX audit U19).
  await expect(page.getByRole("button", { name: "Set due date" })).toHaveCount(0);
  await startDraft(page);
  await page.getByRole("button", { name: "Set due date" }).click();
  await page.getByLabel("Due date", { exact: true }).fill("2099-10-14");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: "Due Oct 14" })).toBeVisible();
});

test("switching faces still lands with reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const { rackId } = await seedRack();
  await page.goto(`/planograms/${rackId}`);
  await hydrated(page);
  // A rack never published shows no grid until a draft starts.
  await page.getByRole("button", { name: "Start planogram" }).click();
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
  await page.getByRole("button", { name: "Start planogram" }).click();
  await expect(page.getByRole("button", { name: "Add product" })).toBeVisible();
  await page.getByRole("group", { name: "Side" }).getByRole("button", { name: "Back" }).click();
  const grid = page.getByRole("region", { name: /, Back:/ });
  await expect(grid).toBeVisible();
  // The slide-in is over once nothing is animating inside the grid.
  await expect.poll(() => grid.evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
  const scroller = grid.locator("> div").first();
  await expect.poll(() => scroller.evaluate((el) => (el.scrollWidth <= el.clientWidth ? getComputedStyle(el).maskImage : "scrolls"))).toBe("none");
});

test("there is no sticky action bar on a phone: the last card scrolls to the bottom with nothing over it", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) >= 768, "A phone thing: the nav tabs are the only fixed bar.");
  await openTable(page);
  await startDraft(page);
  await expect(page.locator("[data-action-bar]")).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const card = await page.locator("[data-card]").last().boundingBox();
  const tabs = await page.getByRole("navigation", { name: "Main" }).filter({ visible: true }).boundingBox();
  expect(card && tabs && card.y + card.height <= tabs.y + 1).toBe(true);
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

test("the panel's face picker moves a tile to the other face and says nothing in a toast", async ({ page }) => {
  const { rackId } = await seedRack();
  await page.goto(`/planograms/${rackId}`);
  await hydrated(page);
  await page.getByRole("button", { name: "Start planogram" }).click();
  await page.getByRole("button", { name: "Add product" }).click();
  await page.getByLabel("Find a product").fill("E2E High");
  await page.getByRole("button", { name: /E2E High-Rise Pant/ }).click();
  await saved(page);
  await page.getByRole("button", { name: "Edit E2E High-Rise Pant" }).click();
  const face = page.getByRole("group", { name: "Face" });
  await expect(face.getByRole("button", { name: "Front" })).toHaveAttribute("aria-pressed", "true");
  await face.getByRole("button", { name: "Back" }).click();
  await expect(face.getByRole("button", { name: "Back" })).toHaveAttribute("aria-pressed", "true");
  // Picking is not leaving: focus stays on the choice, so the next key still acts on it (L3, non-set view).
  await expect(face.getByRole("button", { name: "Back" })).toBeFocused();
  // On a phone the sheet is modal and hides the grid from the page's tree; elsewhere the view follows the tile.
  if (sizeOf(test.info()) !== "phone") await expect(page.getByRole("region", { name: /, Back:/ })).toBeVisible();
});
