import { expect, goldColors, storeTrigger, test } from "./fixtures";

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

test("tapping a product opens its edit page", async ({ page }, testInfo) => {
  await page.goto("/products");
  const row = page.getByRole("main").getByRole("list").getByRole("link").first();
  if (testInfo.project.use.hasTouch) await row.tap();
  else await row.click();
  await expect(page).toHaveURL(/\/products\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("the filter narrows the list", async ({ page }) => {
  await page.goto("/products");
  const first = (await page.getByRole("main").getByRole("list").getByRole("link").first().locator("span span").first().textContent())!.trim();
  await page.getByLabel("Filter products").fill(first);
  await page.getByLabel("Filter products").press("Enter");
  await expect(page).toHaveURL(/\?q=/);
  await expect(page.getByRole("main").getByRole("link", { name: new RegExp(first) }).first()).toBeVisible();
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
    const names = document.querySelectorAll("main ul a span.font-medium");
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
