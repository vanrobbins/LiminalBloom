import { afterAll, describe, expect, it } from "vitest";

import { dropStores, makeStore, seedStoreFixtures } from "@/lib/products/test-stores";

import { floorPlanograms } from "./floor-view";
import { previewPublish, publishDraft } from "./publish";
import { loadPlanogram } from "./queries";
import { startDraft } from "./write";

afterAll(dropStores);

const VAN = { id: null, name: "Van" };

describe("floorPlanograms", () => {
  it("gives the latest published version per fixture, this store only", async () => {
    const a = await makeStore("floor-a");
    const fa = await seedStoreFixtures(a);
    const b = await makeStore("floor-b");
    const fb = await seedStoreFixtures(b);
    for (const [store, f] of [[a, fa], [b, fb]] as const) {
      await startDraft(store, f.fixtureId, null); // starts from the seeded floor: the pant
      const preview = await previewPublish(store, f.fixtureId);
      await publishDraft(store, f.fixtureId, preview?.planogramVersion ?? 0, null, null, VAN);
    }
    // A second draft on a: the map still shows version 1, plus the note.
    await startDraft(a, fa.fixtureId, (await loadPlanogram(a, fa.fixtureId)).row?.version ?? null);

    const floor = await floorPlanograms(a);
    expect(Object.keys(floor)).toEqual([fa.fixtureId]);
    expect(floor[fa.fixtureId]).toMatchObject({ hasDraft: true, latest: { number: 1 } });
    expect(floor[fa.fixtureId].latest?.placements.length).toBeGreaterThan(0);
  });

  it("a planogram never published has no latest", async () => {
    const a = await makeStore("floor-c");
    const f = await seedStoreFixtures(a);
    await startDraft(a, f.fixtureId, null);
    expect((await floorPlanograms(a))[f.fixtureId]).toMatchObject({ hasDraft: true, latest: null });
  });
});
