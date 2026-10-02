import { describe, expect, it } from "vitest";

import { apply, type Command } from "./commands";
import { entrance, face, fixture, rectangle, store, zone } from "./test-layouts";
import type { Layout } from "./types";

function ids() {
  let n = 0;
  return () => `new-${++n}`;
}

const run = (layout: Layout, command: Command) => apply(layout, command, ids());

describe("outline and corners", () => {
  it("sets the outline in whole inches, keeping its version", () => {
    const result = run(store(), { type: "setOutline", points: [{ x: 0.4, y: 0 }, { x: 100, y: 0.6 }, { x: 100, y: 100 }] });
    expect(result.outline).toEqual({ points: [{ x: 0, y: 0 }, { x: 100, y: 1 }, { x: 100, y: 100 }], version: 1 });
  });

  it("moves, adds and removes a zone's corners", () => {
    const layout = { ...store(), zones: [zone()] };
    const owner = { kind: "zone", id: "zone-a" } as const;

    const moved = run(layout, { type: "moveVertex", owner, index: 2, to: { x: 250, y: 190 } });
    expect(moved.zones[0].points[2]).toEqual({ x: 250, y: 190 });

    const added = run(layout, { type: "insertVertex", owner, after: 0, at: { x: 120, y: 0 } });
    expect(added.zones[0].points).toHaveLength(5);
    expect(added.zones[0].points[1]).toEqual({ x: 120, y: 0 });

    const removed = run(layout, { type: "removeVertex", owner, index: 0 });
    expect(removed.zones[0].points).toHaveLength(3);
  });

  it("will not take a shape below three corners", () => {
    const triangle = { ...store(), zones: [zone({ points: rectangle(0, 0, 100, 100).slice(0, 3) })] };
    const result = run(triangle, { type: "removeVertex", owner: { kind: "zone", id: "zone-a" }, index: 0 });
    expect(result.zones[0].points).toHaveLength(3);
  });
});

describe("move", () => {
  it("carries a zone's fixtures with it", () => {
    const layout = { ...store(), zones: [zone()], fixtures: [fixture({ x: 100, y: 100, zoneId: "zone-a" })] };
    const result = run(layout, { type: "move", ids: ["zone-a"], delta: { x: 12, y: 6 } });
    expect(result.zones[0].points[0]).toEqual({ x: 12, y: 6 });
    expect(result.fixtures[0]).toMatchObject({ x: 112, y: 106, zoneId: "zone-a" });
  });

  it("moves a whole table set when a lower table is dragged", () => {
    const layout: Layout = {
      ...store(),
      tableSets: [{ id: "set", upperFixtureId: "fixture-a", version: 1 }],
      fixtures: [fixture(), fixture({ id: "low", y: 130, depth: 24, tableSetId: "set", setSide: "front" })],
    };
    const result = run(layout, { type: "move", ids: ["low"], delta: { x: 10, y: 0 } });
    expect(result.fixtures.find((f) => f.id === "fixture-a")?.x).toBe(310);
    expect(result.fixtures.find((f) => f.id === "low")?.x).toBe(310);
  });

  it("keeps an entrance on its wall", () => {
    const layout = { ...store(), entrances: [entrance()] };
    const result = run(layout, { type: "move", ids: ["entrance-a"], delta: { x: 24, y: -30 } });
    expect(result.entrances[0]).toMatchObject({ x: 264, y: 360 });
  });
});

describe("updates", () => {
  it("trims names (Review Focus 4) and wraps rotation", () => {
    const layout = { ...store(), fixtures: [fixture()] };
    const result = run(layout, { type: "updateFixture", id: "fixture-a", changes: { name: "  Window table  ", rotation: 375 } });
    expect(result.fixtures[0]).toMatchObject({ name: "Window table", rotation: 15 });
  });

  it("ignores position, rotation and name on a lower table", () => {
    const layout: Layout = {
      ...store(),
      tableSets: [{ id: "set", upperFixtureId: "fixture-a", version: 1 }],
      fixtures: [fixture(), fixture({ id: "low", y: 130, depth: 24, tableSetId: "set", setSide: "front" })],
    };
    const result = run(layout, { type: "updateFixture", id: "low", changes: { x: 0, rotation: 90, name: "Mine", depth: 30 } });
    expect(result.fixtures.find((f) => f.id === "low")).toMatchObject({ x: 300, rotation: 0, depth: 30, name: "Table 1 · Front" });
  });
});

describe("faces", () => {
  const rack = { ...store(), fixtures: [fixture({ type: "rack", name: "Rack 1", width: 48, depth: 24 })], faces: [face({ side: "front", columns: 4 })] };

  it("turns a rack's back side on with a new grid, and off again", () => {
    const on = run(rack, { type: "setFace", fixtureId: "fixture-a", side: "back", on: true });
    expect(on.faces).toContainEqual({ id: "new-1", fixtureId: "fixture-a", side: "back", columns: 4, rows: 3, version: 0 });

    const off = run(on, { type: "setFace", fixtureId: "fixture-a", side: "back", on: false });
    expect(off.faces.map((f) => f.side)).toEqual(["front"]);
  });

  it("does not add a side twice", () => {
    expect(run(rack, { type: "setFace", fixtureId: "fixture-a", side: "front", on: true })).toBe(rack);
  });

  it("sets a grid", () => {
    const result = run(rack, { type: "setFaceGrid", faceId: "face-a", columns: 8, rows: 2 });
    expect(result.faces[0]).toMatchObject({ columns: 8, rows: 2 });
  });
});

describe("attachLowerTable", () => {
  const table = { ...store(), fixtures: [fixture()], faces: [face()] };

  it("adds a set, a lower table as long as the side, and its top grid", () => {
    const result = run(table, { type: "attachLowerTable", upperId: "fixture-a", side: "front" });
    expect(result.tableSets).toEqual([{ id: "new-1", upperFixtureId: "fixture-a", version: 0 }]);
    expect(result.fixtures.find((f) => f.id === "new-2")).toMatchObject({
      width: 72,
      depth: 24,
      tableSetId: "new-1",
      setSide: "front",
      x: 300,
      y: 130,
      name: "Table 1 · Front",
    });
    expect(result.faces).toContainEqual(expect.objectContaining({ id: "new-3", fixtureId: "new-2", side: "top" }));
  });

  it("refuses a second lower table on the same side, and anything but a table", () => {
    const once = run(table, { type: "attachLowerTable", upperId: "fixture-a", side: "front" });
    expect(run(once, { type: "attachLowerTable", upperId: "fixture-a", side: "front" })).toBe(once);

    const rack = { ...store(), fixtures: [fixture({ type: "rack" })] };
    expect(run(rack, { type: "attachLowerTable", upperId: "fixture-a", side: "front" })).toBe(rack);
  });
});

describe("duplicate and delete", () => {
  it("copies a fixture with its faces and the next name", () => {
    const layout = { ...store(), fixtures: [fixture()], faces: [face()] };
    const result = run(layout, { type: "duplicate", ids: ["fixture-a"], offset: { x: 24, y: 24 } });
    expect(result.fixtures[1]).toMatchObject({ id: "new-1", name: "Table 2", x: 324, y: 124, version: 0 });
    expect(result.faces[1]).toMatchObject({ id: "new-2", fixtureId: "new-1", version: 0 });
  });

  it("leaves a deleted zone's fixtures on the map", () => {
    const layout = { ...store(), zones: [zone()], fixtures: [fixture({ x: 100, y: 100, zoneId: "zone-a" })] };
    const result = run(layout, { type: "delete", ids: ["zone-a"] });
    expect(result.zones).toEqual([]);
    expect(result.fixtures[0].zoneId).toBeNull();
  });

  it("takes a table set's lower tables and faces with the upper", () => {
    const layout: Layout = {
      ...store(),
      tableSets: [{ id: "set", upperFixtureId: "fixture-a", version: 1 }],
      fixtures: [fixture(), fixture({ id: "low", y: 130, depth: 24, tableSetId: "set", setSide: "front" })],
      faces: [face(), face({ id: "face-low", fixtureId: "low" })],
    };
    const result = run(layout, { type: "delete", ids: ["fixture-a"] });
    expect(result.fixtures).toEqual([]);
    expect(result.tableSets).toEqual([]);
    expect(result.faces).toEqual([]);
  });
});
