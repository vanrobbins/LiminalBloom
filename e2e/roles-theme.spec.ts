// The Roles screen in dark as well as light (roles.spec.ts and roles-edit.spec.ts are light-only; this file is
// not in playwright.config.ts's LIGHT_ONLY).

import { test, expect } from "./fixtures";
import { seedTeam } from "./people-store";
import { box, openRoles, reveal, reviewAndSave } from "./roles-page";

test.beforeEach(async () => {
  await seedTeam();
});

// A staged cell is tinted
// apart from an untouched one, the locked cell reads as locked, and the summary dialog's text is readable.
// Nothing is saved, so there is nothing to put back.
test("the Roles screen's staged cell, locked cell and summary dialog read in this theme", async ({ page }) => {
  await openRoles(page);
  await reveal(page, "Sales Associate");
  const staged = box(page, "Mark sold out", "Sales Associate");
  await staged.uncheck();

  // What a cell (or, on a phone, a row) sits on: the nearest ancestor with a background of its own.
  const tint = (input: import("@playwright/test").Locator) =>
    input.evaluate((el) => {
      for (let node: Element | null = el; node; node = node.parentElement) {
        const bg = getComputedStyle(node).backgroundColor;
        if (!/^rgba?\(.*, 0\)$|^transparent$/.test(bg)) return bg;
      }
      return "none";
    });
  const untouched = box(page, "Run sales", "Sales Associate");
  expect(await tint(staged)).not.toBe(await tint(untouched));
  const locked = page.getByRole("checkbox", { name: "Manage people for Store Manager, always on" });
  await reveal(page, "Store Manager");
  await expect(locked).toBeDisabled();
  await expect(locked).toBeChecked();

  const dialog = await reviewAndSave(page, "Save changes to 1 role?");
  const ratio = await dialog.evaluate((el) => {
    const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
    const lum = (css: string) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = "#000";
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = [...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)].map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const style = getComputedStyle(el);
    const [hi, lo] = [lum(style.color), lum(style.backgroundColor)].sort((a, b) => b - a);
    return (hi + 0.05) / (lo + 0.05);
  });
  expect(ratio).toBeGreaterThanOrEqual(4.5);
});
