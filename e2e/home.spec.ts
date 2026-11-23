// Home as the Store Manager of a worker's own store (0.7.0.6 spec section 14): the first tab, the search,
// and the cards that need planograms and products (seeded in home-store.ts). Only the Quick Adjust test
// changes data (a sold-out product, a draft adjustment), and puts it back.

import type { Page } from "@playwright/test";

import { mainNav } from "./access-page";
import { expect, hydrated, sizeOf, test } from "./fixtures";
import { addDays, clearHomeWork, dueText, endAdjustWork, homeStoreId, startAdjustWork, seedHomeWork, unplacedProducts, type HomeSeed } from "./home-store";

let seed: HomeSeed;
test.beforeAll(async () => {
  seed = await seedHomeWork();
});
test.afterAll(() => clearHomeWork());

async function openHome(page: Page) {
  await page.goto("/home");
  await expect(page.getByRole("heading", { level: 1, name: "Hub" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Planograms to finish" })).toBeVisible();
  await hydrated(page);
}

const card = (page: Page, title: string) => page.getByRole("region", { name: title });

test("Hub is the first tab and the current one, and the search sits above the cards", async ({ page }) => {
  await openHome(page);
  const first = mainNav(page).getByRole("link").first();
  await expect(first).toHaveText("Hub");
  await expect(first).toHaveAttribute("aria-current", "page");
  const search = page.getByRole("search");
  await expect(search.getByRole("searchbox", { name: "Search products" })).not.toBeFocused();
  const [searchBox, cards] = await Promise.all([search.boundingBox(), card(page, "Planograms to finish").boundingBox()]);
  expect(searchBox!.y).toBeLessThan(cards!.y);
});

test("searching a style number and pressing Enter opens Products with the card", async ({ page }) => {
  await openHome(page);
  await page.getByRole("search").getByRole("searchbox", { name: "Search products" }).fill("E2E-HRP-01");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/products\?q=E2E-HRP-01$/);
  await expect(page.getByRole("main").getByRole("list").first().getByRole("button", { name: /^E2E High-Rise Pant/ })).toBeVisible();
});

test("Planograms to finish lists overdue, then upcoming, then the undated draft, with their chips", async ({ page }, testInfo) => {
  await openHome(page);
  const work = card(page, "Planograms to finish");
  const rows = work.getByRole("listitem").getByRole("link");
  await expect(rows).toHaveCount(3);
  // Name, then an optional type hint (newer builds), then the state and the due date.
  const named = (name: string, tail: string) => new RegExp(`^${name}, (?:[A-Za-z ]+, )?Draft${tail}$`);
  await expect(rows.nth(0)).toHaveAccessibleName(named("Table 1", `, ${dueText(seed.overdue, seed.today)}`));
  await expect(rows.nth(1)).toHaveAccessibleName(named("Rack 1", `, ${dueText(seed.upcoming, seed.today)}`));
  await expect(rows.nth(2)).toHaveAccessibleName(named("Wall A", ""));
  await expect(rows.nth(0)).toContainText(/Draft\s*Overdue · /);
  await expect(rows.nth(1)).toContainText(/Due /);
  expect(await rows.nth(1).innerText()).not.toContain("Overdue");
  await expect(work.getByRole("link", { name: "All planograms", exact: true })).toHaveAttribute("href", "/planograms");
  // Published work with no draft and no date isn't work.
  await expect(work.getByText("Wall B", { exact: true })).toHaveCount(0);

  // The card spans both columns from a tablet up, and the one beside it doesn't.
  const [wide, narrow] = await Promise.all([work.boundingBox(), card(page, "Not placed yet").boundingBox()]);
  if (sizeOf(testInfo) === "phone") expect(Math.abs(wide!.width - narrow!.width)).toBeLessThan(2);
  else expect(wide!.width).toBeGreaterThan(narrow!.width * 1.5);

  await rows.nth(0).click();
  await expect(page).toHaveURL(new RegExp(`/planograms/${seed.ids.table}$`));
});

test("a seeded publish shows in Recently published and opens its planogram", async ({ page }) => {
  await openHome(page);
  const row = card(page, "Recently published").getByRole("link", { name: `Wall B, Version 1, published by ${seed.publisher}` });
  await expect(row).toContainText(`Version 1 · ${seed.publisher}`);
  await row.click();
  await expect(page).toHaveURL(new RegExp(`/planograms/${seed.ids.published}$`));
  await expect(page.getByRole("heading", { level: 1, name: "Wall B" })).toBeVisible();
});

test("Not placed yet counts what the database counts and opens the filtered list", async ({ page }) => {
  const products = await unplacedProducts(await homeStoreId());
  expect(products).toBeGreaterThan(0);
  await openHome(page);
  const notPlaced = card(page, "Not placed yet");
  await expect(notPlaced.getByRole("link", { name: `${products} ${products === 1 ? "product" : "products"} not placed` })).toHaveAttribute("href", "/products?place=unplaced");
  // Only Wall C has no planogram: the others have one each.
  await expect(notPlaced.getByRole("link", { name: "1 fixture without a planogram" })).toHaveAttribute("href", "/planograms");
  await notPlaced.getByRole("link", { name: /products? not placed$/ }).click();
  await expect(page).toHaveURL(/\/products\?place=unplaced$/);
  await expect(page.getByRole("main").getByRole("list").first().getByText("E2E Pocket Tee")).toBeVisible();
});

test("the cards run in the spec's order, and the due dates are the store's own days", async ({ page }) => {
  expect(addDays(seed.today, -3)).toBe(seed.overdue);
  await openHome(page);
  const titles = await page.getByRole("main").getByRole("heading", { level: 2 }).allTextContents();
  const known = ["Set up the store", "Planograms to finish", "Sold out on display", "Invitations waiting", "Not placed yet", "Recently published", "Recent changes"];
  expect(titles).toEqual(known.filter((title) => titles.includes(title)));
  expect(titles).toEqual(expect.arrayContaining(["Planograms to finish", "Not placed yet", "Recently published"]));
});

test("Quick Adjust work shows: Sold out on display after Planograms to finish, and a draft adjustment as an Adjusting row", async ({ page }) => {
  await startAdjustWork(seed.ids.published);
  try {
    await openHome(page);
    const titles = await page.getByRole("main").getByRole("heading", { level: 2 }).allTextContents();
    expect(titles.indexOf("Sold out on display")).toBe(titles.indexOf("Planograms to finish") + 1);
    await expect(card(page, "Sold out on display").getByRole("link", { name: "1 sold-out product still on display" })).toHaveAttribute("href", "/products?status=sold_out&place=floor");
    const row = card(page, "Planograms to finish").getByRole("link", { name: /^Wall B, (?:[A-Za-z ]+, )?Adjusting$/ });
    await expect(row).toHaveAttribute("href", `/planograms/${seed.ids.published}/adjust`);
    await row.click();
    await expect(page).toHaveURL(new RegExp(`/planograms/${seed.ids.published}/adjust$`));
    await expect(page.getByRole("heading", { level: 1, name: "Wall B" })).toBeVisible();
  } finally {
    await endAdjustWork();
  }
});
