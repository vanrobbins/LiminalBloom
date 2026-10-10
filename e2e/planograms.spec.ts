import { expect, hydrated, test } from "./fixtures";
import { seedLayout, seedTableSet } from "./map-store";
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
  await expect(page.getByRole("button", { name: "Edit E2E High-Rise Pant" })).toBeVisible();
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
  await page.getByRole("button", { name: "Edit E2E High-Rise Pant" }).click();
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
  await expect(page.getByRole("table")).toContainText("A2–B3");

  await page.getByRole("button", { name: "Publish…" }).click();
  await expect(page.getByText("Top: 2 added")).toBeVisible();
  await page.getByLabel("Summary (optional)").fill("E2E reset");
  await page.getByRole("button", { name: "Publish version 1" }).click();
  await expect(page.getByText("Version 1 published", { exact: true })).toBeVisible();
  await expect(page.getByText(/Version 1 · published/)).toBeVisible();

  await page.goto("/search?q=E2E-PT-01");
  await expect(page.getByRole("main").getByRole("list").first()).toContainText("Table 1, D1 · Folded");
});

test("history shows the version, and restore makes it the draft", async ({ page }) => {
  await openTable(page);
  await startDraft(page);
  await page.getByRole("button", { name: "Publish…" }).click();
  await page.getByRole("button", { name: "Publish version 1" }).click();
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
    await expect(otherPage.getByRole("button", { name: "Edit E2E High-Rise Pant" })).toBeVisible();

    await addTee(page, "D1");
    await movePant(otherPage, "A2");
    // The other device's save reply carried the tee.
    await expect(otherPage.getByRole("table")).toContainText("E2E Pocket Tee");
    // Coming back to the first device reloads the draft.
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(page.getByRole("table")).toContainText("A2–B3");
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
  await page.getByRole("button", { name: "Publish version 1" }).click();
  await expect(page.getByText("Version 1 published", { exact: true })).toBeVisible();

  await page.goto("/search?q=E2E-HRP-01");
  await page.getByRole("main").getByRole("list").first().getByRole("button", { name: /E2E High-Rise Pant/ }).click();
  await page.getByRole("link", { name: "Open planogram" }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/planograms\/[0-9a-f-]+\?product=/);
  await expect(page.getByText(/Version 1 · published/)).toBeVisible();
  await expect(page.locator("[data-placement][data-marked]")).toHaveCount(1);
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
