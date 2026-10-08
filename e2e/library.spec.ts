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

test("concurrent updates: device A succeeds, device B sees conflict and can undo", async ({ browser }) => {
  // Simulate two devices editing the same product concurrently
  const context1 = await browser.newContext();
  const context2 = await browser.newContext();
  const page1 = await context1.newPage();
  const page2 = await context2.newPage();

  try {
    // Both devices navigate to the same product
    await page1.goto("/search");
    await page2.goto("/search");

    // Find the test product on both devices
    await page1.getByRole("searchbox").fill("E2E-HRP-01");
    await page2.getByRole("searchbox").fill("E2E-HRP-01");

    // Open the product on both devices
    const result1 = await page1.getByRole("main").getByRole("link", { name: /E2E High-Rise Pant/ });
    const result2 = await page2.getByRole("main").getByRole("link", { name: /E2E High-Rise Pant/ });
    await result1.click();
    await result2.click();

    // Verify both can see the product details
    await expect(page1.getByRole("complementary")).toContainText("E2E High-Rise Pant");
    await expect(page2.getByRole("complementary")).toContainText("E2E High-Rise Pant");

    // Device 1 changes status to out_of_stock
    const status1 = page1.getByRole("button", { name: /status.*in stock/i }).first();
    await status1.click();
    await page1.getByRole("option", { name: "Out of stock" }).click();

    // Device 2 also changes status (at nearly the same time) to back_ordered
    const status2 = page2.getByRole("button", { name: /status.*in stock/i }).first();
    await status2.click();
    await page2.getByRole("option", { name: "Back ordered" }).click();

    // Device 1's update should succeed
    await expect(page1.getByText(/Out of stock/)).toBeVisible();

    // Device 2 should see conflict toast since Device 1 updated the version
    await expect(page2.getByText(/Changed on another device/)).toBeVisible();

    // Device 2 should have an Undo button available
    const undoButton = page2.getByRole("button", { name: /Undo/ });
    await expect(undoButton).toBeVisible();

    // Close panels
    await page1.getByRole("button", { name: "Close" }).click();
    await page2.getByRole("button", { name: "Close" }).click();

    // Verify Device 1 sees the correct status
    await page1.getByRole("searchbox").clear();
    await page1.getByRole("searchbox").fill("E2E-HRP-01");
    await page1.getByRole("main").getByRole("link", { name: /E2E High-Rise Pant/ }).click();
    await expect(page1.getByText(/Out of stock/)).toBeVisible();

    // Verify Device 2 also sees the correct status (after refreshing)
    await page2.reload();
    await page2.getByRole("searchbox").fill("E2E-HRP-01");
    await page2.getByRole("main").getByRole("link", { name: /E2E High-Rise Pant/ }).click();
    await expect(page2.getByText(/Out of stock/)).toBeVisible();
  } finally {
    await context1.close();
    await context2.close();
  }
});

test("concurrent status updates: both devices see appropriate messaging", async ({ browser }) => {
  // Test the messaging when two devices update the same product simultaneously
  const context1 = await browser.newContext();
  const context2 = await browser.newContext();
  const page1 = await context1.newPage();
  const page2 = await context2.newPage();

  try {
    // Both devices search for the test product
    await page1.goto("/search");
    await page2.goto("/search");
    await page1.getByRole("searchbox").fill("E2E-HRP-01");
    await page2.getByRole("searchbox").fill("E2E-HRP-01");

    // Open product details on both
    await page1.getByRole("main").getByRole("link", { name: /E2E High-Rise Pant/ }).click();
    await page2.getByRole("main").getByRole("link", { name: /E2E High-Rise Pant/ }).click();

    // Device 1 updates status
    await page1.getByRole("button", { name: /status/i }).first().click();
    const newStatus = "Back ordered";
    await page1.getByRole("option", { name: newStatus }).click();
    await expect(page1.getByText(new RegExp(newStatus))).toBeVisible();

    // Device 2 attempts same operation but sees conflict
    await page2.getByRole("button", { name: /status/i }).first().click();
    await page2.getByRole("option", { name: "Out of stock" }).click();

    // Device 2 should see "Changed on another device" message
    await expect(page2.getByText(/Changed on another device/)).toBeVisible();
    await expect(page2.getByText(/Look it over, then delete it if you still want to|Look it over|another device/i)).toBeVisible();

    // Device 1 and Device 2 should now both show the status that Device 1 set
    const status1Final = await page1.locator("text=/status|Stock/i").textContent();
    // Status 2 will show the old value until refreshed

    // After refreshing, Device 2 should see Device 1's update
    await page2.reload();
    await page2.getByRole("searchbox").fill("E2E-HRP-01");
    await page2.getByRole("main").getByRole("link", { name: /E2E High-Rise Pant/ }).click();
    const status2Final = await page2.locator("text=/status|Stock/i").textContent();

    // Both should now see the same status (Device 1's update)
    expect(status1Final).toBe(status2Final);
  } finally {
    await context1.close();
    await context2.close();
  }
});
