import { describe, expect, it } from "vitest";

import { applyChanges, changeCount, diff, emptyChanges, isEmpty, versionConflicts } from "./diff";
import { entities } from "./entities";
import { fixture, store, zone } from "./test-layouts";

describe("diff", () => {
  it("is empty between equal layouts, even with different versions", () => {
    expect(isEmpty(diff({ ...store(), zones: [zone()] }, { ...store(), zones: [zone({ version: 4 })] }))).toBe(true);
  });

  it("records inserts, updates and deletes with the versions they expect", () => {
    const base = { ...store(), zones: [zone({ version: 3 })], fixtures: [fixture({ version: 2 })] };
    const next = { ...store(), zones: [zone({ name: "Windows", version: 3 }), zone({ id: "zone-b", version: 0 })], fixtures: [] };
    const changes = diff(base, next);
    expect(changes.zones).toEqual([
      { item: next.zones[0], expectedVersion: 3 },
      { item: next.zones[1], expectedVersion: null },
    ]);
    expect(changes.deletes).toEqual([{ collection: "fixtures", id: "fixture-a", expectedVersion: 2 }]);
    expect(changeCount(changes)).toBe(3);
  });

  it("records a new outline as an insert", () => {
    const changes = diff({ ...store(), outline: null }, store());
    expect(changes.outline).toEqual({ item: store().outline, expectedVersion: null });
  });
});

describe("applyChanges", () => {
  it("turns the base into the next layout", () => {
    const base = { ...store(), zones: [zone()], fixtures: [fixture()] };
    const next = { ...store(), zones: [zone({ name: "Windows" })], fixtures: [fixture({ id: "fixture-b" })] };
    expect(entities(applyChanges(base, diff(base, next)))).toEqual(entities(next));
  });
});

describe("versionConflicts", () => {
  it("names items saved elsewhere first, and inserts of ids that exist", () => {
    const server = { ...store(), zones: [zone({ version: 5 })], fixtures: [fixture()] };
    const changes = diff({ ...store(), zones: [zone({ version: 4 })] }, { ...store(), zones: [zone({ name: "X", version: 4 })], fixtures: [fixture()] });
    expect(versionConflicts(server, changes).sort()).toEqual(["fixture-a", "zone-a"]);
  });

  it("lists conflicts in change order", () => {
    const base = { ...store(), zones: [zone({ version: 1 }), zone({ id: "zone-b", version: 1 })] };
    const next = { ...store(), zones: [zone({ name: "X" }), zone({ id: "zone-b", name: "Y" })] };
    const server = { ...store(), zones: [zone({ version: 2 }), zone({ id: "zone-b", version: 2 })] };
    expect(versionConflicts(server, diff(base, next))).toEqual(["zone-a", "zone-b"]);
  });
});

describe("outline changes", () => {
  it("records an edited outline with its version, and counts it", () => {
    const edited = { ...store(), outline: { ...store(120, 120).outline!, version: 1 } };
    const changes = diff(store(), edited);
    expect(changes.outline).toEqual({ item: edited.outline, expectedVersion: 1 });
    expect(changeCount(changes)).toBe(1);
  });

  it("leaves the outline out when it is unchanged", () => {
    expect(diff(store(), store()).outline).toBeNull();
  });

  it("applies and checks an outline change", () => {
    const edited = { ...store(), outline: { ...store(120, 120).outline!, version: 1 } };
    const changes = diff(store(), edited);
    expect(applyChanges(store(), changes).outline).toBe(edited.outline);
    expect(versionConflicts(store(), changes)).toEqual([]);
    expect(versionConflicts({ ...store(), outline: { ...store().outline!, version: 2 } }, changes)).toEqual(["outline"]);
    expect(versionConflicts({ ...store(), outline: null }, changes)).toEqual(["outline"]);
  });
});

describe("emptyChanges and deletes", () => {
  it("starts empty", () => {
    expect(isEmpty(emptyChanges())).toBe(true);
  });

  it("applies deletes", () => {
    const base = { ...store(), fixtures: [fixture()] };
    expect(applyChanges(base, diff(base, store())).fixtures).toEqual([]);
  });
});

describe("versionConflicts more", () => {
  it("accepts matching versions, matching inserts and matching deletes", () => {
    const server = { ...store(), zones: [zone({ version: 4 })], fixtures: [fixture({ version: 2 })] };
    const next = { ...store(), zones: [zone({ name: "X", version: 4 }), zone({ id: "zone-b", version: 0 })] };
    expect(versionConflicts(server, diff(server, next))).toEqual([]);
  });

  it("flags a delete of an item already gone or saved elsewhere", () => {
    const base = { ...store(), fixtures: [fixture({ version: 2 })] };
    const changes = diff(base, store());
    expect(versionConflicts(store(), changes)).toEqual(["fixture-a"]);
    expect(versionConflicts({ ...store(), fixtures: [fixture({ version: 3 })] }, changes)).toEqual(["fixture-a"]);
  });

  it("flags an update of an item that is gone", () => {
    const base = { ...store(), zones: [zone()] };
    const changes = diff(base, { ...store(), zones: [zone({ name: "X" })] });
    expect(versionConflicts(store(), changes)).toEqual(["zone-a"]);
  });
});
