// The palette's product answer, with the session and the search stood in: the guard, what makes a
// search happen, and that it always asks for 5 in the member's own store.

import { beforeEach, describe, expect, it, vi } from "vitest";

const member = vi.hoisted(() => ({ current: { kind: "signed-out" } as Record<string, unknown> }));
const queries = vi.hoisted(() => ({ search: vi.fn() }));
vi.mock("@/lib/current-member", async (original) => ({ ...(await original<object>()), getCurrentMember: async () => member.current }));
vi.mock("@/lib/products/queries", () => queries);

const { GET } = await import("./route");

const call = (q?: string, extra = "") => {
  const query = q === undefined ? "" : "?q=" + encodeURIComponent(q);
  return GET(new Request("http://localhost/api/palette/products" + query + (query === "" ? extra.replace("&", "?") : extra)));
};
const page = {
  results: [{ id: "p1", name: "Navy Tee", styleNumber: "NT-1", status: "in_stock", imageKey: "secret.webp", version: 4, locations: [{ label: "Front table" }, { label: "Bin A" }] }],
  total: 9,
};

beforeEach(() => {
  queries.search.mockReset().mockResolvedValue(page);
  member.current = { kind: "member", activeStoreId: "store-a", switches: ["view"] };
});

describe("GET /api/palette/products", () => {
  it("is 401 signed out and 403 without view, without searching", async () => {
    member.current = { kind: "signed-out" };
    expect((await call("navy")).status).toBe(401);
    member.current = { kind: "member", activeStoreId: "store-a", switches: [] };
    expect((await call("navy")).status).toBe(403);
    expect(queries.search).not.toHaveBeenCalled();
  });

  it("searches the member's store for the top 5 and trims the answer", async () => {
    const response = await call("navy");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      products: [{ id: "p1", name: "Navy Tee", styleNumber: "NT-1", status: "in_stock", place: "Front table", more: 1 }],
      total: 9,
    });
    expect(queries.search).toHaveBeenCalledTimes(1);
    const [store, input, limit] = queries.search.mock.calls[0];
    expect(store).toBe("store-a");
    expect(input).toMatchObject({ q: "navy", categoryIds: [], colors: [], statuses: [], places: [], offset: 0 });
    expect(limit).toBe(5);
  });

  it("takes the store from the session whatever the request says", async () => {
    await call("navy", "&store=store-b&storeId=store-b");
    expect(queries.search.mock.calls[0][0]).toBe("store-a");
  });

  it("answers empty, without a search, for a query that is not text", async () => {
    for (const q of [undefined, "", " ", "a", "--", "  x "]) {
      const response = await call(q);
      expect(await response.json()).toEqual({ products: [], total: 0 });
    }
    expect(queries.search).not.toHaveBeenCalled();
  });

  it("is 400 for a query over 80 characters", async () => {
    expect((await call("a".repeat(81))).status).toBe(400);
    expect((await call("a".repeat(80))).status).toBe(200);
  });

  it("is never cached", async () => {
    expect((await call("navy")).headers.get("cache-control")).toBe("private, no-store");
    expect((await call("a")).headers.get("cache-control")).toBe("private, no-store");
  });

  it("names the fixture to Quick Adjust only for a member with planograms.draft (nothing a viewer lacks the switch for is sent)", async () => {
    queries.search.mockResolvedValue({
      results: [{ id: "p1", name: "Navy Tee", styleNumber: "NT-1", status: "sold_out", locations: [{ label: "Front table", floor: { fixtureId: "fx1" } }] }],
      total: 1,
    });
    expect((await (await call("navy")).json()).products[0]).not.toHaveProperty("adjustFixtureId");
    member.current = { kind: "member", activeStoreId: "store-a", switches: ["view", "planograms.publish"] };
    expect((await (await call("navy")).json()).products[0]).not.toHaveProperty("adjustFixtureId");
    member.current = { kind: "member", activeStoreId: "store-a", switches: ["view", "planograms.draft"] };
    expect((await (await call("navy")).json()).products[0]).toMatchObject({ adjustFixtureId: "fx1" });
  });
});
