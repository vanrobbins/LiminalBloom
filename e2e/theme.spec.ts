// What a theme can change, in light and dark at every size: gold where it
// belongs and nowhere else, the theme switches, and long names, which the
// behaviour specs leave to light (DECISIONS 10-11, 11-06).

import { expect, goldColors, hydrated, storeTrigger, test, userMenuButton } from "./fixtures";
import { seedLayout } from "./map-store";
import { seedCatalog } from "./product-store";

test.beforeEach(async () => {
  await seedLayout();
  await seedCatalog();
});

function mainNav(page: import("@playwright/test").Page) {
  return page.locator("nav[data-nav]").filter({ visible: true });
}

test("no status badge is gold", async ({ page }) => {
  await page.goto("/products");

  const gold = await goldColors(page);

  const badges = page.locator("[data-status]");
  await expect(badges.first()).toBeVisible();

  const used = await badges.evaluateAll((elements) =>
    elements.flatMap((element) => {
      const style = getComputedStyle(element);
      return [style.color, style.backgroundColor];
    }),
  );

  for (const color of gold) {
    expect(used).not.toContain(color);
  }
});

test("long store and product names wrap instead of overflowing", async ({ page }) => {
  await page.goto("/products");
  await expect(page.locator("[data-status]").first()).toBeVisible();
  // Rewriting text before React has hydrated is reported as a mismatch.
  await page.waitForLoadState("networkidle");

  // Real stores and products can have names this long; the fixtures do not.
  await page.evaluate(() => {
    // One with no break points at all (hyphens would let it wrap), and one
    // long enough to need three lines.
    const unbroken = "SupercalifragilisticexpialidociousDenimCollectionFlagshipEdition";
    const spaced =
      "Fashion Island Newport Beach Flagship Store and Outlet Annex at the Pacific Coast Highway";
    for (const label of document.querySelectorAll("[data-store-label]")) {
      label.textContent = unbroken;
    }
    const names = document.querySelectorAll("main ul button span.font-medium");
    names[0].textContent = unbroken;
    names[1].textContent = spaced;
  });

  // Anything past the right edge, anywhere on the page -- the shell included.
  const pastTheEdge = await page.evaluate(() =>
    [...document.querySelectorAll("body *")]
      .filter((element) => {
        const box = element.getBoundingClientRect();
        return box.width > 0 && box.right > window.innerWidth + 0.5;
      })
      .map((element) => element.textContent?.slice(0, 40)),
  );
  expect(pastTheEdge).toEqual([]);

  // The name stays inside the store button's border.
  const spilled = await storeTrigger(page).evaluateAll((buttons) =>
    buttons
      .filter((button) => button.scrollHeight > button.clientHeight + 1)
      .map((button) => button.textContent),
  );
  expect(spilled).toEqual([]);

  // The account button beside it is still a full touch target, on screen.
  const account = (await page.locator("[data-user-menu]").filter({ visible: true }).boundingBox())!;
  expect(account.height).toBeGreaterThanOrEqual(44);
  expect(account.x + account.width).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test("marks the current page, in gold", async ({ page }) => {
  await page.goto("/products");
  const current = mainNav(page).getByRole("link", { name: "Products" });

  await expect(current).toHaveAttribute("aria-current", "page");
  await expect(mainNav(page).getByRole("link", { name: "Account" })).not.toHaveAttribute(
    "aria-current",
    "page",
  );

  const gold = await goldColors(page);
  const used = await current.evaluate((element) => {
    const style = getComputedStyle(element);
    return [style.color, style.backgroundColor, style.borderTopColor];
  });
  expect(used.some((color) => gold.includes(color))).toBe(true);
});

test("the corner theme toggle is only on pages without the shell", async ({ page }) => {
  const corner = page.getByRole("button", { name: /^Switch to (light|dark)$/ });

  await page.goto("/products");
  await expect(storeTrigger(page)).toBeVisible();
  await expect(corner).toHaveCount(0);

  await page.goto("/");
  await expect(corner).toBeVisible();
});

test("the account menu switches the theme", async ({ page }) => {
  await page.goto("/products");
  const isDark = () => page.evaluate(() => document.documentElement.classList.contains("dark"));
  const before = await isDark();

  await hydrated(page);
  await userMenuButton(page).click();
  const name = /^Switch to (light|dark) theme$/;
  await page
    .getByRole("menuitem", { name })
    .or(page.getByRole("button", { name }))
    .filter({ visible: true })
    .click();

  await expect.poll(isDark).toBe(!before);
});
