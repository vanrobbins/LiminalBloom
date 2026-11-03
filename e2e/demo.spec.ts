// The working prototype (/demo, and "Try it" on the walkthrough's phone),
// branch feature/prototype-walkthrough. Made-up data in the tab only.

import { expect, test } from "./fixtures";

test.use({ storageState: { cookies: [], origins: [] } });

test("runs the core loop: sold out, Quick Adjust, the new spot in Products", async ({ page }) => {
  await page.goto("/demo");
  const nav = page.getByRole("navigation", { name: "Demo app" });

  await nav.getByRole("button", { name: "Products" }).click();
  await page.getByRole("searchbox").fill("strait jn");
  await page.getByRole("button", { name: /Straight jean/ }).click();
  await page.getByRole("dialog").getByRole("radio", { name: "Sold out" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).first().click();

  await nav.getByRole("button", { name: "Home" }).click();
  await page.getByRole("button", { name: /Straight jean/ }).click();
  await page.getByRole("radio", { name: /Wide-leg jean/ }).click();
  await page.getByRole("button", { name: "Publish adjustment" }).click();

  await expect(page.getByRole("dialog", { name: "Wide-leg jean" })).toContainText("Denim wall · Bottom shelf · 2–4 ft from left");
});

test("a Sales Associate sees planograms read-only and can only submit a Quick Adjust", async ({ page }) => {
  await page.goto("/demo");
  const nav = page.getByRole("navigation", { name: "Demo app" });
  await nav.getByRole("button", { name: "Account" }).click();
  await page.getByRole("radio", { name: /Sales Associate/ }).click();

  await nav.getByRole("button", { name: "Planograms" }).click();
  await page.getByRole("button", { name: /Front table/ }).click();
  await expect(page.getByText(/View only/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Add product" })).toHaveCount(0);

  await nav.getByRole("button", { name: "Home" }).click();
  await page.getByRole("button", { name: /Crew sock/ }).click();
  await page.getByRole("radio", { name: /Ankle sock/ }).click();
  await expect(page.getByRole("button", { name: "Submit for review" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Publish adjustment" })).toHaveCount(0);
});

test("moves a product by keyboard and publishes a new version", async ({ page }) => {
  await page.goto("/demo");
  await page.getByRole("navigation", { name: "Demo app" }).getByRole("button", { name: "Planograms" }).click();
  await page.getByRole("button", { name: /Denim wall/ }).click();

  await page.getByRole("button", { name: "High-rise pant" }).click();
  await page.getByRole("button", { name: "High-rise pant" }).press("ArrowUp");
  await expect(page.getByText("Denim wall · Top shelf · 1–2½ ft from left")).toBeVisible();
  await expect(page.getByText("Draft · 1 change")).toBeVisible();

  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Published version 5", { exact: true })).toBeVisible();
});

test("a drag onto another product is refused and names it", async ({ page, isMobile }) => {
  test.skip(isMobile, "mouse drag; touch drag is the same pointer path");
  await page.goto("/demo");
  await page.getByRole("navigation", { name: "Demo app" }).getByRole("button", { name: "Planograms" }).click();
  await page.getByRole("button", { name: /Denim wall/ }).click();

  const box = (await page.getByRole("button", { name: "High-rise pant" }).boundingBox())!;
  const cell = box.width / 3;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + cell * 3, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();

  await expect(page.getByText("Blocked by Relaxed jean. High-rise pant stays where it was.")).toBeVisible();
  await expect(page.getByText("Published version 4", { exact: true })).toBeVisible();
});

test("Try it on the walkthrough opens the chapter's screen and keeps the store between chapters", async ({ page }) => {
  await page.goto("/#locator");
  await page.getByRole("radio", { name: "Try it" }).click();
  const demo = page.locator("[data-demo]");
  await expect(demo.getByRole("dialog", { name: "High-rise pant" })).toBeVisible();
  await demo.getByRole("dialog").getByRole("radio", { name: "Sold out" }).click();

  await page.goto("/#home");
  await expect(demo.getByRole("button", { name: /High-rise pant/ })).toBeVisible();
});
