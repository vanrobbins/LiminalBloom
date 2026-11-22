// The palette index against real stores, with the session stood in: only the member's own store's
// planograms and zones, and only for someone who can view.

import { randomUUID } from "node:crypto";

import { afterAll, describe, expect, it, vi } from "vitest";

import { db } from "@/db";
import { zones } from "@/db/schema";
import { dropStores, makeStore, seedStoreFixtures } from "@/lib/products/test-stores";

const member = vi.hoisted(() => ({ current: { kind: "signed-out" } as Record<string, unknown> }));
vi.mock("@/lib/current-member", async (original) => ({ ...(await original<object>()), getCurrentMember: async () => member.current }));

const { GET } = await import("./route");

afterAll(dropStores);

const zone = (storeId: string, name: string) => ({
  id: randomUUID(),
  storeId,
  name,
  type: "display" as const,
  color: "zone-1" as const,
  points: [{ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 120, y: 120 }],
});

describe("GET /api/palette", () => {
  it("is 401 when signed out or without a store, never cached", async () => {
    for (const kind of ["signed-out", "no-store"]) {
      member.current = { kind };
      const response = await GET();
      expect(response.status).toBe(401);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
    }
  });

  it("is 403 without the view switch", async () => {
    member.current = { kind: "member", activeStoreId: "x", switches: ["products.stock"] };
    expect((await GET()).status).toBe(403);
  });

  it("answers with this store's planograms and zones, private and uncached; another store's zone never appears", async () => {
    const mine = await makeStore("palette-mine");
    const theirs = await makeStore("palette-theirs");
    await seedStoreFixtures(mine);
    await db.insert(zones).values([zone(mine, "My Denim"), zone(theirs, "Their Secret Zone")]);
    member.current = { kind: "member", activeStoreId: mine, switches: ["view"] };
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const body = await response.json();
    expect(body.zones.map((z: { name: string }) => z.name)).toEqual(["My Denim"]);
    expect(JSON.stringify(body)).not.toContain("Their Secret Zone");
    expect(Array.isArray(body.planograms)).toBe(true);
  });
});
