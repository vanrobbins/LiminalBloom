// Hung layers (DECISIONS 11-09): a hung product dragged partly onto another
// joins behind it and still shows and clicks where it shows; Alt+Up moves it
// forward; Search names the layer after publishing.

import { expect, hydrated, sizeOf, test } from "./fixtures";
import { seedFrameRun, seedLayout } from "./map-store";
import { seedCatalog } from "./product-store";

type Page = import("@playwright/test").Page;

test.beforeEach(async () => {
  await seedLayout();
  await seedCatalog();
});

const tile = (page: Page, name: string) => page.getByRole("button", { name: new RegExp(`^${name}, `) }).filter({ visible: true });
const saved = (page: Page) => expect(page.locator("[data-draft-status]")).toHaveText("Saved");

async function add(page: Page, search: string, name: RegExp) {
  await page.getByRole("button", { name: "Add product" }).click();
  await page.getByLabel("Find a product").fill(search);
  await page.getByRole("button", { name }).click();
  await saved(page);
}

test("a tee dragged partly onto a pant hangs behind it, clicks where it shows, moves forward, and Search names the layer", async ({ page }, info) => {
  test.skip(sizeOf(info) !== "desktop", "The mouse drag is the desktop form; touch shares the same gesture code.");
  await seedFrameRun();
  await page.goto("/planograms");
  await page.getByRole("link", { name: /Frame A1/ }).click();
  await hydrated(page);
  await page.getByRole("button", { name: "Start draft" }).click();
  await add(page, "E2E High", /E2E High-Rise Pant/);
  await add(page, "E2E Pocket", /E2E Pocket Tee/);

  // The tee (added second, so selected) sits right of the pant; one half foot left overlaps it.
  const pant = tile(page, "E2E High-Rise Pant");
  const tee = tile(page, "E2E Pocket Tee");
  const pantBox = (await pant.boundingBox())!;
  const unit = (pantBox.width + 2) / 2;
  const teeBox = (await tee.boundingBox())!;
  const x = teeBox.x + teeBox.width / 2;
  const y = teeBox.y + teeBox.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - unit, y, { steps: 10 });
  await expect(page.getByText(/behind E2E High-Rise Pant/)).toBeVisible();
  await page.mouse.up();
  await saved(page);
  await expect(tee).toHaveAttribute("data-depth", "1");
  await expect(pant).toHaveAttribute("data-depth", "0");

  // Select the pant from its card (the selected tee lies over it), then the tee by its badge, which shows in the offset strip.
  await page.locator("[data-card]").filter({ hasText: "E2E High-Rise Pant" }).click();
  await expect(pant).toHaveAttribute("aria-pressed", "true");
  await tee.locator("[data-count-badge]").click();
  await expect(tee).toHaveAttribute("aria-pressed", "true");

  await page.keyboard.press("Alt+ArrowUp");
  await saved(page);
  await expect(tee).toHaveAttribute("data-depth", "0");
  await expect(pant).toHaveAttribute("data-depth", "1");
  // At the front now: the selection bar's Move forward is spent, Move back isn't.
  await expect(page.getByRole("button", { name: "Move forward" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Move back" })).toBeEnabled();
  await expect(page.locator("[data-card]").filter({ hasText: "E2E High-Rise Pant" }).locator("[data-layer-words]")).toHaveText("2nd from front");

  await page.getByRole("button", { name: "Publish…" }).click();
  await page.getByRole("button", { name: /^Publish to / }).click();
  await expect(page.getByText("Version 1 published", { exact: true })).toBeVisible();

  await page.goto("/products?q=E2E-HRP-01");
  await expect(page.getByRole("main").getByRole("list").first()).toContainText("2nd from front");
});
