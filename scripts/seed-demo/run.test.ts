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
  seedDemoPeople: vi.fn(),
  checkDemoPeople: vi.fn(),
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
vi.mock("./people", () => ({
  seedDemoPeople: fake.seedDemoPeople,
  checkDemoPeople: fake.checkDemoPeople,
  DEMO_PEOPLE: [{ email: "demo.store.manager@liminalbloom.app" }, { email: "demo.sales.associate@liminalbloom.app" }],
}));
vi.mock("@/lib/db/with-store", () => ({ withStore: fake.withStore }));
vi.mock("@/lib/products/images", () => ({
  listImages: fake.listImages,
  deleteImagesQuietly: fake.deleteImagesQuietly,
}));

const { seedDemo } = await import("./run");

/** What the check found: the seed hands this map on, so ownership is asked once. */
const EXISTING = new Map([["demo.store.manager@liminalbloom.app", "user_1"]]);

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
  fake.seedDemoPeople.mockReset().mockImplementation(async () => 5);
  fake.checkDemoPeople.mockReset().mockImplementation(async () => EXISTING);
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

  it("puts one account per built-in role into the demo store, and none when the batch fails", async () => {
    await run();
    expect(fake.seedDemoPeople).toHaveBeenCalledWith("store_demo", { isProduction: false, existing: EXISTING });
    fake.seedDemoPeople.mockClear();
    fake.withStore.mockRejectedValue(new Error("boom"));
    await expect(run()).rejects.toThrow("boom");
    expect(fake.seedDemoPeople).not.toHaveBeenCalled();
  });

  it("checks the role accounts before replacing the catalog, so a refusal leaves the store as it was", async () => {
    fake.checkDemoPeople.mockRejectedValue(new Error("demo.vm.manager@liminalbloom.app is not ours"));
    const confirm = async () => true;
    await expect(seedDemo({ isProduction: true, withPeople: true, confirm })).rejects.toThrow("not ours");
    expect(fake.checkDemoPeople).toHaveBeenCalledWith("store_demo", { isProduction: true });
    expect(fake.withStore).not.toHaveBeenCalled();
    expect(fake.seedDemoPeople).not.toHaveBeenCalled();
  });

  it("asks about ownership once: the check runs one time and the seed gets its answer", async () => {
    await run();
    expect(fake.checkDemoPeople).toHaveBeenCalledTimes(1);
    expect(fake.seedDemoPeople.mock.calls[0][1].existing).toBe(EXISTING);
  });

  it("skips that check when the role accounts are skipped", async () => {
    await seedDemo({ isProduction: true, confirm: async () => true });
    expect(fake.checkDemoPeople).not.toHaveBeenCalled();
  });

  it("seeds the role accounts on development, with no flag", async () => {
    await run();
    expect(fake.seedDemoPeople).toHaveBeenCalledWith("store_demo", { isProduction: false, existing: EXISTING });
  });

  it("seeds no role accounts on production without --with-people", async () => {
    const confirm = vi.fn<(message: string) => Promise<boolean>>(async () => true);
    await seedDemo({ isProduction: true, confirm });
    expect(fake.withStore).toHaveBeenCalled();
    expect(fake.seedDemoPeople).not.toHaveBeenCalled();
    expect(confirm.mock.calls[0][0]).not.toContain("demo.store.manager@liminalbloom.app");
  });

  it("seeds them on production with --with-people, and the prompt names every email", async () => {
    const confirm = vi.fn<(message: string) => Promise<boolean>>(async () => true);
    await seedDemo({ isProduction: true, withPeople: true, confirm });
    expect(fake.seedDemoPeople).toHaveBeenCalledWith("store_demo", { isProduction: true, existing: EXISTING });
    const message = confirm.mock.calls[0][0];
    expect(message).toContain("demo.store.manager@liminalbloom.app");
    expect(message).toContain("demo.sales.associate@liminalbloom.app");
  });
});
