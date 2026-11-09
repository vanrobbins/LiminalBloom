// Every page, at every size: touch targets are at least 44 px (§5.4) and
// nothing scrolls sideways on a phone. Light only: a theme can't change a size.

import { expect, test } from "./fixtures";

const PAGES = ["/", "/sign-in", "/sign-up", "/account", "/products", "/create-store", "/layout", "/planograms"];

for (const path of PAGES) {
  test.describe(path, () => {
    test("every control is at least 44px tall, and nothing scrolls sideways", async ({ page }) => {
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

      // Soft, so a page that breaks both rules reports both.
      expect.soft(tooSmall, "controls under 44 px").toEqual([]);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, "sideways scroll").toBe(0);
    });
  });
}
