// The layout rules every page keeps (§5.4): controls at least 44 px tall, nothing scrolling sideways.
// Shared by layout.spec.ts and the specs of pages that need an account of their own.

import { expect, type Page } from "@playwright/test";

export async function expectLayout(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");

  const tooSmall = await page
    .locator("button:visible, a:visible, input:visible, select:visible")
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
          // A radio or checkbox is tapped through its label row, which is the 44 px target (the box itself is 20).
          height: Math.round(((element instanceof HTMLInputElement && ["radio", "checkbox"].includes(element.type) && element.closest("label")) || element).getBoundingClientRect().height),
        }))
        .filter(({ height }) => height < 44),
    );

  // Soft, so a page that breaks both rules reports both.
  expect.soft(tooSmall, "controls under 44 px").toEqual([]);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "sideways scroll").toBe(0);
}
