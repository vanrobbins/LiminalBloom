// Every page, at every size and in both themes: touch targets are at least
// 44 px (§5.4) and nothing scrolls sideways on a phone.

import { expect, test } from "./fixtures";
import { seedFrameRun, seedLayout } from "./map-store";

const PAGES = ["/", "/sign-in", "/sign-up", "/account", "/products", "/create-store", "/layout", "/planograms"];

for (const path of PAGES) {
  test.describe(path, () => {
    test("every control is at least 44px tall", async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      const tooSmall = await page
        .locator("button:visible, a:visible, input:visible")
        .evaluateAll((elements) =>
          elements
            // Next.js dev tools live in their own shadow root; not ours.
            .filter((element) => element.getRootNode() === document)
            // The skip link is 1 px until focused, by design (sr-only).
            .filter((element) => element.getBoundingClientRect().width > 1)
            .map((element) => ({
              control:
                element.getAttribute("aria-label") ||
                element.textContent?.trim() ||
                element.getAttribute("name") ||
                element.tagName,
              height: Math.round(element.getBoundingClientRect().height),
            }))
            .filter(({ height }) => height < 44),
        );

      expect(tooSmall).toEqual([]);
    });

    test("does not scroll sideways", async ({ page }) => {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBe(0);
    });
  });
}

// Non-text contrast (WCAG 1.4.11), in both themes: the rail is what tells a
// frame rack from a table on the map (frame racks spec §8).
test("a frame rack's rail stands out from the rack", async ({ page }) => {
  await seedLayout();
  await seedFrameRun();
  await page.goto("/layout");
  const rack = page.locator('[data-fixture-name="Frame A1"]');
  await expect(rack).toBeVisible();

  const ratio = await rack.evaluate((group) => {
    const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
    const channels = (css: string) => {
      ctx.fillStyle = "#000";
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      return [...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)];
    };
    const luminance = (css: string) => {
      const [r, g, b] = channels(css).map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const rail = getComputedStyle(group.querySelector("[data-rail] line")!).stroke;
    const body = getComputedStyle(group.querySelector(":scope > rect")!).fill;
    const [high, low] = [luminance(rail), luminance(body)].sort((a, b) => b - a);
    return (high + 0.05) / (low + 0.05);
  });
  expect(ratio).toBeGreaterThanOrEqual(3);
});
