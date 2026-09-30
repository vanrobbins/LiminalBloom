// Every page, at every size and in both themes: touch targets are at least
// 44 px (§5.4) and nothing scrolls sideways on a phone.

import { expect, test } from "./fixtures";

const PAGES = ["/", "/sign-in", "/sign-up", "/account", "/products", "/create-store"];

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
