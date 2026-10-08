// The seed's step order (spec §6, Review Focus 5), with the database and Blob
// stood in: images go up first, and old ones come down only after the batch
// has committed, so a failed batch never leaves rows pointing at missing files.

import { beforeEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => [] as string[]);
const fake = vi.hoisted(() => ({
  withStore: vi.fn(),
  imageExists: vi.fn(),
  putImage: vi.fn(),
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
  buildDemo: () => ({
    products: [],
    categories: [],
    locations: [],
    images: new Map([["stores/store_demo/products/seed-new.svg", "<svg/>"]]),
  }),
  demoStatements: () => [],
}));
vi.mock("@/lib/db/with-store", () => ({ withStore: fake.withStore }));
vi.mock("@/lib/products/images", () => ({
  imageExists: fake.imageExists,
  putImage: fake.putImage,
  listImages: fake.listImages,
  deleteImagesQuietly: fake.deleteImagesQuietly,
}));

const { seedDemo } = await import("./run");

const run = () => seedDemo({ isProduction: false, confirm: async () => false });

beforeEach(() => {
  calls.length = 0;
  vi.spyOn(console, "log").mockImplementation(() => {});
  fake.imageExists.mockReset().mockResolvedValue(false);
  fake.putImage.mockReset().mockImplementation(async () => {
    calls.push("put");
  });
  fake.withStore.mockReset().mockImplementation(async () => {
    calls.push("batch");
  });
  fake.listImages.mockReset().mockImplementation(async () => {
    calls.push("list");
    return ["stores/store_demo/products/seed-new.svg", "stores/store_demo/products/seed-old.svg"];
  });
  fake.deleteImagesQuietly.mockReset().mockImplementation(async () => {
    calls.push("delete");
  });
});

describe("seedDemo", () => {
  it("uploads, then writes, then removes only the images nothing uses", async () => {
    await run();
    expect(calls).toEqual(["put", "batch", "list", "delete"]);
    expect(fake.deleteImagesQuietly).toHaveBeenCalledWith(["stores/store_demo/products/seed-old.svg"]);
  });

  it("deletes no images when the batch fails", async () => {
    fake.withStore.mockRejectedValue(new Error("boom"));
    await expect(run()).rejects.toThrow("boom");
    expect(fake.putImage).toHaveBeenCalled();
    expect(fake.deleteImagesQuietly).not.toHaveBeenCalled();
  });
});
