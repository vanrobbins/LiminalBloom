import { describe, expect, it } from "vitest";

import { changedIds, deepEqual, entities, getEntity, keyOf, nameOf, sameExceptVersion, setEntity, splitKey } from "./entities";
import { entrance, face, fixture, store, zone } from "./test-layouts";
import { OUTLINE_ID } from "./types";

describe("entities and setEntity", () => {
  it("keys every item, including the outline", () => {
    const keys = [...entities({ ...store(), zones: [zone()] }).keys()];
    expect(keys).toEqual([keyOf("outline", OUTLINE_ID), keyOf("zones", "zone-a")]);
  });

  it("replaces, appends and removes by key", () => {
    const layout = { ...store(), zones: [zone()] };
    const renamed = setEntity(layout, keyOf("zones", "zone-a"), zone({ name: "Windows" }));
    expect(renamed.zones[0].name).toBe("Windows");
    const added = setEntity(layout, keyOf("zones", "zone-b"), zone({ id: "zone-b" }));
    expect(added.zones).toHaveLength(2);
    expect(setEntity(layout, keyOf("zones", "zone-a"), undefined).zones).toEqual([]);
  });
});

describe("equality", () => {
  it("compares deeply and can ignore versions", () => {
    expect(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false);
    expect(sameExceptVersion(zone({ version: 1 }), zone({ version: 7 }))).toBe(true);
    expect(sameExceptVersion(zone(), zone({ name: "Other" }))).toBe(false);
  });
});

describe("changedIds", () => {
  it("includes a changed face's fixture", () => {
    const before = { ...store(), fixtures: [fixture()], faces: [face()] };
    const after = { ...before, faces: [face({ columns: 9 })] };
    expect(changedIds(before, after)).toEqual(new Set(["face-a", "fixture-a"]));
  });
});

describe("keys and lookup", () => {
  it("splits a key at the first colon only", () => {
    expect(splitKey(keyOf("zones", "a:b"))).toEqual(["zones", "a:b"]);
  });

  it("finds items by key, or nothing", () => {
    const layout = { ...store(), zones: [zone()], entrances: [entrance()] };
    expect(getEntity(layout, keyOf("outline", OUTLINE_ID))).toBe(layout.outline);
    expect(getEntity(layout, keyOf("zones", "zone-a"))).toBe(layout.zones[0]);
    expect(getEntity(layout, keyOf("zones", "missing"))).toBeUndefined();
    expect(getEntity({ ...layout, outline: null }, keyOf("outline", OUTLINE_ID))).toBeUndefined();
  });

  it("sets and clears the outline", () => {
    const moved = { points: store(120, 120).outline!.points, version: 1 };
    expect(setEntity(store(), keyOf("outline", OUTLINE_ID), moved).outline).toBe(moved);
    expect(setEntity(store(), keyOf("outline", OUTLINE_ID), undefined).outline).toBeNull();
  });

  it("leaves a list alone when removing an id that is not there", () => {
    const layout = { ...store(), zones: [zone()] };
    expect(setEntity(layout, keyOf("zones", "missing"), undefined).zones).toEqual(layout.zones);
  });

  it("names only items that have a name", () => {
    expect(nameOf(zone())).toBe("Front tables");
    expect(nameOf(entrance())).toBeNull();
  });
});

describe("deepEqual edge cases", () => {
  it("tells arrays from objects and checks lengths", () => {
    expect(deepEqual([], {})).toBe(false);
    expect(deepEqual([1, 2], [1])).toBe(false);
    expect(deepEqual({ a: 1 }, { b: 1 })).toBe(false);
    expect(deepEqual(null, {})).toBe(false);
  });

  it("treats a missing item as different from a present one", () => {
    expect(sameExceptVersion(undefined, undefined)).toBe(true);
    expect(sameExceptVersion(zone(), undefined)).toBe(false);
  });
});

describe("changedIds more", () => {
  it("includes the upper table of a changed set, from either side", () => {
    const set = { id: "set-a", upperFixtureId: "fixture-b", version: 1 };
    const base = store();
    expect(changedIds(base, { ...base, tableSets: [set] })).toEqual(new Set(["set-a", "fixture-b"]));
    expect(changedIds({ ...base, tableSets: [set] }, base)).toEqual(new Set(["set-a", "fixture-b"]));
  });

  it("ignores version-only differences", () => {
    const base = { ...store(), zones: [zone()] };
    expect(changedIds(base, { ...base, zones: [zone({ version: 9 })] })).toEqual(new Set());
  });
});
