// Every test fails on a console error or an uncaught exception, which is
// how React reports hydration mismatches. A test that expects one (a 401
// from a wrong password) matches it with `allowedConsoleError`.
//
// One pattern rather than a list: Playwright reads an array passed to
// test.use() as a [value, options] pair.

import { test as base, expect, type Page } from "@playwright/test";

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

/** A store's button in the switcher on /products. */
export function storeButton(page: Page, name: string) {
  return page
    .getByRole("radiogroup", { name: "Stores" })
    .locator(`button[data-store-name="${name}"]`);
}
