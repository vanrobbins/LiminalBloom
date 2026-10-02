import { describe, expect, it } from "vitest";

import { normalize } from "./normalize";
import { entrance, face, fixture, rectangle, store, zone } from "./test-layouts";
import type { Layout } from "./types";

describe("normalize", () => {
  it("puts each fixture in the zone holding its centre", () => {
    const layout = { ...store(), zones: [zone()], fixtures: [fixture({ x: 100, y: 100 }), fixture({ id: "out", name: "Table 2" })] };
    const result = normalize(layout);
    expect(result.fixtures.find((f) => f.id === "fixture-a")?.zoneId).toBe("zone-a");
    expect(result.fixtures.find((f) => f.id === "out")?.zoneId).toBeNull();
  });

  it("places and names lower tables from their upper, in the upper's zone", () => {
    const layout: Layout = {
      ...store(),
      zones: [zone()],
      tableSets: [{ id: "set", upperFixtureId: "fixture-a", version: 1 }],
      fixtures: [
        fixture({ x: 100, y: 100 }),
        fixture({ id: "low", name: "", x: 0, y: 0, width: 72, depth: 24, tableSetId: "set", setSide: "front" }),
      ],
    };
    const lower = normalize(layout).fixtures.find((f) => f.id === "low");
    expect(lower).toMatchObject({ x: 100, y: 130, rotation: 0, name: "Table 1 · Front", zoneId: "zone-a" });
  });

  it("drops a set, its lower tables and their faces when the upper goes", () => {
    const layout: Layout = {
      ...store(),
      tableSets: [{ id: "set", upperFixtureId: "gone", version: 1 }],
      fixtures: [fixture({ id: "low", tableSetId: "set", setSide: "front" })],
      faces: [face({ fixtureId: "low" })],
    };
    const result = normalize(layout);
    expect(result.tableSets).toEqual([]);
    expect(result.fixtures).toEqual([]);
    expect(result.faces).toEqual([]);
  });

  it("drops a set with no lower tables left", () => {
    const layout: Layout = {
      ...store(),
      tableSets: [{ id: "set", upperFixtureId: "fixture-a", version: 1 }],
      fixtures: [fixture()],
    };
    expect(normalize(layout).tableSets).toEqual([]);
  });

  it("puts a stray entrance back on the wall", () => {
    const layout = { ...store(), entrances: [entrance({ y: 340 })] };
    expect(normalize(layout).entrances[0]).toMatchObject({ x: 240, y: 360 });
  });

  it("returns the very same layout when nothing needs deriving", () => {
    const layout = { ...store(), zones: [zone({ points: rectangle(0, 0, 100, 100) })], entrances: [entrance()] };
    expect(normalize(layout)).toBe(layout);
  });

  it("is idempotent", () => {
    const layout = { ...store(), zones: [zone()], fixtures: [fixture({ x: 100, y: 100, rotation: 37 })], entrances: [entrance({ y: 340 })] };
    const once = normalize(layout);
    expect(normalize(once)).toBe(once);
  });
});
