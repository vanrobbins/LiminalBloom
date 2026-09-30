import { expect, storeButton, test } from "./fixtures";
import { HOME_STORE, SECOND_STORE } from "./test-account";

test("no status badge is gold", async ({ page }) => {
  await page.goto("/products");

  const gold = await page.evaluate(() => {
    const probe = document.createElement("span");
    document.body.append(probe);
    const colors = ["var(--brand)", "var(--brand-strong)"].map((value) => {
      probe.style.color = value;
      return getComputedStyle(probe).color;
    });
    probe.remove();
    return colors;
  });

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

test("tapping a product opens its details; Escape closes them", async ({ page }, testInfo) => {
  await page.goto("/products");
  const row = page.getByRole("list").getByRole("button").first();
  const name = (await row.locator("span").first().textContent())!.trim();

  if (testInfo.project.use.hasTouch) {
    await row.tap();
  } else {
    await row.click();
  }

  const sheet = page.getByRole("dialog", { name });
  await expect(sheet).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
});

test("dragging the sheet down closes it", async ({ page }) => {
  await page.goto("/products");
  const row = page.getByRole("list").getByRole("button").first();
  const name = (await row.locator("span").first().textContent())!.trim();
  await row.click();

  const sheet = page.getByRole("dialog", { name });
  await expect(sheet).toBeVisible();
  // Let the opening slide finish before dragging.
  await page.waitForTimeout(600);

  const box = (await sheet.boundingBox())!;
  const x = box.x + box.width / 2;
  await page.mouse.move(x, box.y + 12);
  await page.mouse.down();
  await page.mouse.move(x, box.y + box.height, { steps: 12 });
  await page.mouse.up();

  await expect(sheet).toBeHidden();
});

test("long store and product names wrap instead of overflowing", async ({ page }) => {
  await page.goto("/products");
  await expect(page.locator("[data-status]").first()).toBeVisible();

  // Real stores and products can have names this long; the fixtures do not.
  await page.evaluate(() => {
    // Long enough to need three lines; and one with no break points at all
    // (hyphens would let it wrap).
    const spaced =
      "Fashion Island Newport Beach Flagship Store and Outlet Annex at the Pacific Coast Highway";
    const unbroken = "SupercalifragilisticexpialidociousDenimCollectionFlagshipEdition";
    const stores = document.querySelectorAll('[role="radiogroup"] button');
    stores[0].textContent = spaced;
    stores[1].textContent = unbroken;
    document.querySelector("ul button span")!.textContent = unbroken;
  });

  // The list clips its rows (overflow-hidden), so a too-wide name never
  // scrolls the page; it just gets cut off. Look for anything past the edge.
  const pastTheEdge = await page.evaluate(() =>
    [...document.querySelectorAll("main *")]
      .filter((element) => element.getBoundingClientRect().right > window.innerWidth)
      .map((element) => element.textContent?.slice(0, 40)),
  );
  expect(pastTheEdge).toEqual([]);

  // Text stays inside each store button's border.
  const spilled = await page
    .locator('[role="radiogroup"] button')
    .evaluateAll((buttons) =>
      buttons
        .filter((button) => button.scrollHeight > button.clientHeight + 1)
        .map((button) => button.textContent),
    );
  expect(spilled).toEqual([]);
});

test("switching stores confirms with a toast", async ({ page }) => {
  await page.goto("/products");

  const second = storeButton(page, SECOND_STORE);
  await second.click();
  await expect(page.getByText(`Now working in ${SECOND_STORE}.`).first()).toBeVisible();
  await expect(second).toHaveAttribute("data-state", "on");
  // The second store is empty: the page says so rather than showing a bare list.
  await expect(page.getByText(/No products yet/)).toBeVisible();

  // Leave the account as it started, for the next project.
  const home = storeButton(page, HOME_STORE);
  await home.click();
  await expect(home).toHaveAttribute("data-state", "on");
});
