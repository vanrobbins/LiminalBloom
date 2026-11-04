// The seed's step order (spec §6, Review Focus 5), with the database and Blob
// stood in. Since Week 6.5 the demo has no images (spec §4.6): the batch writes
// first, and the store's old files come down only after it has committed, so a
// failed batch never leaves rows pointing at missing files.

import { beforeEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => [] as string[]);
const fake = vi.hoisted(() => ({
  withStore: vi.fn(),
  listImages: vi.fn(),
  deleteImagesQuietly: vi.fn(),
}));

vi.mock("./target", () => ({
  DEMO_EMAIL: "demo@liminalbloom.app",
  DEMO_STORE: "Liminal Bloom Demo",
  findDemoStore: async () => ({ storeId: "store_demo", productCount: 50 }),
  createDemoStore: vi.fn(),
}));
vi.mock("./build", () => ({
  buildDemo: () => ({ products: [], categories: [], locations: [] }),
  demoStatements: () => [],
}));
vi.mock("@/lib/db/with-store", () => ({ withStore: fake.withStore }));
vi.mock("@/lib/products/images", () => ({
  listImages: fake.listImages,
  deleteImagesQuietly: fake.deleteImagesQuietly,
}));

const { seedDemo } = await import("./run");

const run = () => seedDemo({ isProduction: false, confirm: async () => false });

beforeEach(() => {
  calls.length = 0;
  vi.spyOn(console, "log").mockImplementation(() => {});
  fake.withStore.mockReset().mockImplementation(async () => {
    calls.push("batch");
  });
  fake.listImages.mockReset().mockImplementation(async () => {
    calls.push("list");
    return ["stores/store_demo/products/seed-old.svg", "stores/store_demo/products/upload.webp"];
  });
  fake.deleteImagesQuietly.mockReset().mockImplementation(async () => {
    calls.push("delete");
  });
});

describe("seedDemo", () => {
  it("writes, then removes every old image in the store, the seed's SVGs included", async () => {
    await run();
    expect(calls).toEqual(["batch", "list", "delete"]);
    expect(fake.deleteImagesQuietly).toHaveBeenCalledWith(["stores/store_demo/products/seed-old.svg", "stores/store_demo/products/upload.webp"]);
  });

  it("deletes no images when the batch fails", async () => {
    fake.withStore.mockRejectedValue(new Error("boom"));
    await expect(run()).rejects.toThrow("boom");
    expect(fake.deleteImagesQuietly).not.toHaveBeenCalled();
  });
});
