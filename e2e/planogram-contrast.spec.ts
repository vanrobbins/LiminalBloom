// WCAG contrast of planogram text in both themes (runs in every project,
// light and dark). Colours are OKLCH tokens, so the browser's canvas converts
// them to sRGB; a translucent background is composited over its ancestors.

import { expect, hydrated, test } from "./fixtures";
import { seedLayout } from "./map-store";
import { seedCatalog } from "./product-store";

type Locator = import("@playwright/test").Locator;
type Page = import("@playwright/test").Page;

/** Contrast ratio of an element's text against its effective background. */
async function contrastOf(target: Locator): Promise<number> {
  return target.evaluate((el) => {
    const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
    const rgba = (css: string) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = "#000";
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
      return { r, g, b, a: a / 255 };
    };
    // Backgrounds from the element up to the first opaque one.
    const layers: ReturnType<typeof rgba>[] = [];
    for (let node: Element | null = el; node; node = node.parentElement) {
      const bg = rgba(getComputedStyle(node).backgroundColor);
      if (bg.a > 0) layers.push(bg);
      if (bg.a >= 0.999) break;
    }
    let base = layers.length && layers[layers.length - 1].a >= 0.999 ? layers.pop()! : { r: 255, g: 255, b: 255, a: 1 };
    while (layers.length) {
      const top = layers.pop()!;
      base = {
        r: top.r * top.a + base.r * (1 - top.a),
        g: top.g * top.a + base.g * (1 - top.a),
        b: top.b * top.a + base.b * (1 - top.a),
        a: 1,
      };
    }
    const fg = rgba(getComputedStyle(el).color);
    const lum = (c: { r: number; g: number; b: number }) => {
      const [r, g, b] = [c.r, c.g, c.b].map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const [hi, lo] = [lum(fg), lum(base)].sort((a, b) => b - a);
    return (hi + 0.05) / (lo + 0.05);
  });
}

async function check(target: Locator, what: string) {
  const ratio = await contrastOf(target);
  test.info().annotations.push({ type: "contrast", description: `${what}: ${ratio.toFixed(2)}` });
  expect(ratio, what).toBeGreaterThanOrEqual(4.5);
}

test.beforeEach(async () => {
  await seedLayout();
  await seedCatalog();
});

async function openDraft(page: Page) {
  await page.goto("/planograms");
  await page.getByRole("link", { name: /Table 1/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Table 1" })).toBeVisible();
  await hydrated(page);
  await page.getByRole("button", { name: "Start draft" }).click();
  await expect(page.getByRole("button", { name: "Add product" })).toBeVisible();
}

test("tile labels and status chips are readable", async ({ page }) => {
  await openDraft(page);
  const tile = page.getByRole("button", { name: /^E2E High-Rise Pant, / });
  await expect(tile).toBeVisible();
  await check(tile.locator("span").filter({ hasText: "E2E High-Rise Pant" }), "tile label");
  await check(tile.locator("span").filter({ hasText: /^[HF] \d+$/ }), "tile count badge");

  const chip = page.getByRole("button", { name: "Set due date" });
  await check(chip, "due date chip");
  await chip.click();
  await page.locator("input[type=date]").fill("2000-01-02");
  await page.getByRole("button", { name: "Save" }).click();
  await check(page.getByRole("button", { name: /^Overdue/ }), "overdue chip");

  await page.goto("/planograms");
  await check(page.getByText("Draft", { exact: true }).first(), "list Draft badge");
});
