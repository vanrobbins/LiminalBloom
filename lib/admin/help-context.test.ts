import { describe, expect, it } from "vitest";

import { contextLines } from "./help-context";

describe("contextLines", () => {
  it("names the state, store, role, paused stores and where they asked from", () => {
    expect(contextLines({ state: "member", store: { id: "s", name: "Pioneer Place" }, role: "Sales Associate", from: "/welcome" })).toEqual([
      { label: "State", value: "member" },
      { label: "Store", value: "Pioneer Place" },
      { label: "Role", value: "Sales Associate" },
      { label: "Asked from", value: "/welcome" },
    ]);
    expect(contextLines({ state: "paused", pausedStores: [{ id: "a", name: "A" }, { id: "b", name: "B" }] })).toContainEqual({ label: "Paused stores", value: "A, B" });
  });

  it("skips what is missing or not plain text", () => {
    expect(contextLines({})).toEqual([]);
    expect(contextLines({ state: 4, store: "x", role: "", pausedStores: [1, {}] })).toEqual([]);
  });
});
