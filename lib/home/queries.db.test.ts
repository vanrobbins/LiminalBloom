// Home's own reads against the dev database: the latest publishes (newest first, five at most, this
// store's only) and the product counts, "not placed" through the Products filter's own SQL.

import { randomUUID } from "node:crypto";

import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { planogramVersions, planograms, productLocations } from "@/db/schema";
import { addFixture, addProduct } from "@/lib/planograms/test-planograms";
import { dropStores, makeStore, seedStoreFixtures } from "@/lib/products/test-stores";

import { homeReads } from "./queries";

afterAll(dropStores);

/** A fixture with a planogram and `times.length` published versions, version n at times[n-1]. */
async function publish(store: string, name: string, publishedBy: string, times: string[]): Promise<string> {
  const { fixtureId } = await addFixture(store, { name });
  const id = randomUUID();
  await db.insert(planograms).values({ id, storeId: store, fixtureId, publishedVersion: times.length });
  await db.insert(planogramVersions).values(times.map((t, i) => ({ storeId: store, planogramId: id, number: i + 1, publishedAt: new Date(t), publishedByName: publishedBy, placements: [] })));
  return fixtureId;
}

describe("homeReads recentPublishes", () => {
  it("lists the newest publish first, with the fixture, version and publisher", async () => {
    const store = await makeStore("home-pub");
    const a = await publish(store, "Rack A", "Pat", ["2026-11-01T10:00:00Z", "2026-11-05T10:00:00Z"]);
    const b = await publish(store, "Rack B", "Sam", ["2026-11-03T10:00:00Z"]);
    const { recentPublishes } = await homeReads(store);
    expect(recentPublishes.map((r) => [r.fixtureId, r.fixtureName, r.version, r.publisherName])).toEqual([
      [a, "Rack A", 2, "Pat"],
      [b, "Rack B", 1, "Sam"],
      [a, "Rack A", 1, "Pat"],
    ]);
    expect(recentPublishes[0].publishedAt).toEqual(new Date("2026-11-05T10:00:00Z"));
  });

  it("breaks a tie in time by the higher version number", async () => {
    const store = await makeStore("home-tie");
    await publish(store, "Rack A", "Pat", ["2026-11-01T10:00:00Z", "2026-11-01T10:00:00Z"]);
    expect((await homeReads(store)).recentPublishes.map((r) => r.version)).toEqual([2, 1]);
  });

  it("returns five at most and never another store's publish", async () => {
    const store = await makeStore("home-limit");
    const other = await makeStore("home-limit-other");
    for (let i = 0; i < 7; i++) await publish(store, `Rack ${i}`, "Pat", [`2026-11-0${i + 1}T10:00:00Z`]);
    await publish(other, "Secret rack", "Eve", ["2026-11-10T10:00:00Z"]);
    const { recentPublishes } = await homeReads(store);
    expect(recentPublishes.map((r) => r.fixtureName)).toEqual(["Rack 6", "Rack 5", "Rack 4", "Rack 3", "Rack 2"]);
    expect((await homeReads(other)).recentPublishes.map((r) => r.fixtureName)).toEqual(["Secret rack"]);
  });

  it("is empty for a store that has published nothing", async () => {
    expect((await homeReads(await makeStore("home-none"))).recentPublishes).toEqual([]);
  });
});

describe("homeReads counts", () => {
  it("counts every product, and as not placed only those with no floor or stockroom location", async () => {
    const store = await makeStore("home-count");
    const { categoryId, binId } = await seedStoreFixtures(store); // placed on a table top
    const inBin = await addProduct(store, categoryId, "Bin Tee");
    await db.insert(productLocations).values({ storeId: store, productId: inBin, presentation: "folded", binId });
    await addProduct(store, categoryId, "Loose Tee");
    expect(await homeReads(store)).toMatchObject({ productCount: 3, unplacedCount: 1 });
  });

  it("does not count another store's products", async () => {
    const store = await makeStore("home-count-a");
    const other = await makeStore("home-count-b");
    const { categoryId } = await seedStoreFixtures(other);
    await addProduct(other, categoryId, "Theirs");
    expect(await homeReads(store)).toMatchObject({ productCount: 0, unplacedCount: 0 });
    expect(await homeReads(other)).toMatchObject({ productCount: 2, unplacedCount: 1 });
  });
});
