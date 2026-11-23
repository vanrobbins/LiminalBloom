import { describe, expect, it } from "vitest";

import { buildContext, cleanFrom, FROM_PATHS } from "./context";

const USER = { id: "u1", name: "Van", email: "van@example.com" };

describe("cleanFrom: the whitelist", () => {
  it("keeps a path on the list and drops everything else", () => {
    for (const path of FROM_PATHS) expect(cleanFrom(path)).toBe(path);
    for (const bad of ["/home", "/admin", "/no-access/../admin", "//evil.example", "https://evil.example/paused", "/paused?x=1", " /paused", "", undefined, null, 5, ["/paused"]]) expect(cleanFrom(bad)).toBeNull();
  });
});

describe("buildContext: what the server knows, never what the form says", () => {
  it("names the active store and the role there for a member", () => {
    const member = { kind: "member" as const, user: USER, stores: [{ id: "a", name: "Pioneer Place", companyId: null, companyName: null, regionName: null }, { id: "b", name: "Spring Street", companyId: null, companyName: null, regionName: null }], activeStoreId: "b", role: { id: "r", name: "Assistant Manager", rank: 200 }, switches: [], company: null, isPlatformAdmin: false, helpReplies: 0 };
    expect(buildContext(member, "/no-access")).toEqual({ state: "member", store: { id: "b", name: "Spring Street" }, role: "Assistant Manager", from: "/no-access" });
  });

  it("lists the paused stores for someone whose stores are all paused", () => {
    expect(buildContext({ kind: "paused", user: USER, stores: [{ id: "a", name: "Pioneer Place", kind: "store" }] }, "/paused")).toEqual({ state: "paused", pausedStores: [{ id: "a", name: "Pioneer Place" }], from: "/paused" });
  });

  it("says little for no store or a missing two-step, and drops a from that is not listed", () => {
    expect(buildContext({ kind: "no-store", user: USER }, "/welcome")).toEqual({ state: "no-store", from: "/welcome" });
    expect(buildContext({ kind: "needs-two-factor", user: USER, roleName: "Store Manager" }, "/evil")).toEqual({ state: "needs-two-factor", role: "Store Manager" });
  });
});
