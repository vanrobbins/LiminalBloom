import { expect, test } from "./fixtures";
import { seedLayout } from "./map-store";
import { seedCatalog } from "./product-store";

import { deflateSync } from "node:zlib";

// A real 2400 × 1600 PNG, larger than the 1200 px limit, so the picker's
// in-browser resize has work to do. Built here so no fixture file is needed.
function bigPng(width: number, height: number): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (bytes: Buffer) => {
    let c = 0xffffffff;
    for (const b of bytes) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc(body), body.length + 4);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8-bit RGB
  const rows = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const start = y * (width * 3 + 1) + 1;
    for (let x = 0; x < width; x++) {
      rows[start + x * 3] = (x * 255) / width;
      rows[start + x * 3 + 1] = (y * 255) / height;
      rows[start + x * 3 + 2] = 160;
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
const PHOTO = bigPng(2400, 1600);

test.beforeEach(async () => {
  await seedLayout();
  await seedCatalog();
});

test("adds a product with a photo, finds it, and deletes it", async ({ page }) => {
  test.skip(!process.env.BLOB_READ_WRITE_TOKEN, "Needs the dev Blob store (spec §6.5).");
  const name = `E2E Linen Shirt ${Date.now()}`;
  await page.goto("/products/new");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Style number").fill(`E2E-LS-${Date.now() % 100000}`);
  await page.getByLabel("Category").selectOption({ label: "E2E Tees" });
  await page.getByLabel("Color").fill("White");
  await page.getByLabel("Choose image").setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: PHOTO });
  await expect(page.getByRole("img", { name: "New image for New product" })).toBeVisible();
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page).toHaveURL(/\/products$/);

  await page.getByLabel("Filter products").fill(name);
  await page.getByLabel("Filter products").press("Enter");
  const row = page.getByRole("main").getByRole("link", { name: new RegExp(name) });
  const image = row.getByRole("img", { name });
  await expect(image).toBeVisible();
  await expect(image).toHaveAttribute("src", /\/api\/images\//);
  // The real resize ran: what was stored is within 1200 px, not the 2400 px original.
  const longSide = () => image.evaluate((img: HTMLImageElement) => (img.complete ? Math.max(img.naturalWidth, img.naturalHeight) : 0));
  await expect.poll(longSide).toBeGreaterThan(0);
  expect(await longSide()).toBeLessThanOrEqual(1200);
  await row.click();
  await page.getByRole("button", { name: "Delete product" }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete product" }).click();
  await expect(page).toHaveURL(/\/products$/);
});

test("overrides a footprint for one product", async ({ page }) => {
  await page.goto("/products?q=E2E-HRP-01");
  await page.getByRole("main").getByRole("link", { name: /E2E High-Rise Pant/ }).click();
  await page.getByRole("button", { name: "Override hung for this product" }).click();
  await page.getByRole("button", { name: "More hung columns" }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page).toHaveURL(/\/products$/);
  await page.goto("/products?q=E2E-HRP-01");
  await page.getByRole("main").getByRole("link", { name: /E2E High-Rise Pant/ }).click();
  await expect(page.getByText("Hung (this product only)")).toBeVisible();
  await expect(page.getByRole("group", { name: "Hung columns" })).toContainText("2");
});

test("deleting a category warns how many products go with it", async ({ page }) => {
  await page.goto("/products/categories");
  await page.getByRole("button", { name: "Delete E2E Pants" }).click();
  const dialog = page.getByRole("dialog", { name: "Delete E2E Pants?" });
  await expect(dialog).toContainText("This also deletes its 1 product, with their locations and images.");
  await expect(dialog.getByRole("button", { name: "Delete category and 1 product" })).toBeVisible();
  await dialog.getByRole("button", { name: "Close" }).click();

  await page.getByRole("button", { name: "Add category" }).click();
  await page.getByRole("dialog").getByLabel("Name").fill("E2E Throwaway");
  await page.getByRole("dialog").getByRole("button", { name: "Add category" }).click();
  await page.getByRole("button", { name: "Delete E2E Throwaway" }).click();
  await page.getByRole("dialog", { name: "Delete E2E Throwaway?" }).getByRole("button", { name: "Delete category" }).click();
  await expect(page.getByText("E2E Throwaway", { exact: true })).toBeHidden();
});
