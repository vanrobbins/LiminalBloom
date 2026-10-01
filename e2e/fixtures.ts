// Every test fails on a console error or an uncaught exception, which is
// how React reports hydration mismatches. A test that expects one (a 401
// from a wrong password) matches it with `allowedConsoleError`.
//
// One pattern rather than a list: Playwright reads an array passed to
// test.use() as a [value, options] pair.

import { test as base, expect, type Page, type TestInfo } from "@playwright/test";

export const test = base.extend<{
  allowedConsoleError: RegExp | undefined;
  consoleErrors: string[];
}>({
  allowedConsoleError: [undefined, { option: true }],
  consoleErrors: [
    async ({ page, allowedConsoleError }, use) => {
      const errors: string[] = [];
      const record = (text: string) => {
        if (!allowedConsoleError?.test(text)) {
          errors.push(text);
        }
      };

      page.on("console", (message) => {
        if (message.type() === "error") {
          record(message.text());
        }
      });
      page.on("pageerror", (error) => record(error.message));

      await use(errors);

      expect(errors, "console errors").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

export type Size = "phone" | "tablet" | "desktop";

/** The screen size a project runs at, from its name ("phone-dark"). */
export function sizeOf(testInfo: TestInfo): Size {
  const size = testInfo.project.name.split("-")[0];
  // The setup project has no size of its own: Playwright's desktop default.
  return size === "phone" || size === "tablet" ? size : "desktop";
}

/** The store button in whichever shell form is showing. */
export function storeTrigger(page: Page) {
  return page.locator("[data-store-trigger]").filter({ visible: true });
}

/** A store in the open store menu: the phone's sheet or the dropdown. */
export function storeChoice(page: Page, name: string) {
  return page.locator(`[data-store-name="${name}"]`).filter({ visible: true });
}

/** Switch stores through the shell and wait until the page shows the new one. */
export async function switchStore(page: Page, name: string) {
  await storeTrigger(page).click();
  await storeChoice(page, name).click();
  await expect(storeTrigger(page)).toHaveAttribute("data-store-trigger", name);
}

/** The account button in whichever shell form is showing. */
export function userMenuButton(page: Page) {
  return page.locator("[data-user-menu]").filter({ visible: true });
}

/** The two gold tokens as computed colors, in the theme on screen. */
export async function goldColors(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const probe = document.createElement("span");
    document.body.append(probe);
    const colors = ["var(--brand)", "var(--brand-strong)"].map((value) => {
      probe.style.color = value;
      return getComputedStyle(probe).color;
    });
    probe.remove();
    return colors;
  });
}
