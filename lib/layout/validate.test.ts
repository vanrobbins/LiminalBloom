import { describe, expect, it } from "vitest";

import { face, fixture, rectangle, store, zone } from "./test-layouts";
import { OUTLINE_ID, type Issue, type Layout } from "./types";
import { validate } from "./validate";

const kinds = (issues: Issue[], itemId: string) => issues.filter((i) => i.itemId === itemId).map((i) => i.kind);

describe("the outline", () => {
  it("passes a plain rectangle", () => {
    expect(validate(store())).toEqual([]);
  });

  it("catches a crossing outline and a short wall", () => {
    const bowTie: Layout = {
      ...store(),
      outline: {
        points: [
          { x: 0, y: 0 },
          { x: 480, y: 360 },
          { x: 480, y: 0 },
          { x: 0, y: 360 },
        ],
        version: 1,
      },
    };
    expect(kinds(validate(bowTie), OUTLINE_ID)).toContain("crosses-itself");

    const shortWall: Layout = {
      ...store(),
      outline: { points: [...rectangle(0, 0, 480, 360), { x: 6, y: 360 }], version: 1 },
    };
    expect(kinds(validate(shortWall), OUTLINE_ID)).toContain("short-edge");
  });

  it("asks for an outline once anything is placed", () => {
    const layout: Layout = { ...store(), outline: null, zones: [zone()] };
    expect(kinds(validate(layout), OUTLINE_ID)).toEqual(["corners"]);
  });
});

describe("zones", () => {
  it("flags a zone outside the store, blamed on the outline", () => {
    const layout = { ...store(), zones: [zone({ points: rectangle(400, 0, 200, 100) })] };
    expect(validate(layout)).toContainEqual(
      expect.objectContaining({ itemId: "zone-a", kind: "outside-store", blockerId: OUTLINE_ID }),
    );
  });

  it("flags both of two overlapping zones, naming each other", () => {
    const layout = {
      ...store(),
      zones: [zone(), zone({ id: "zone-b", name: "Wall bays", points: rectangle(200, 0, 100, 100) })],
    };
    const issues = validate(layout);
    expect(issues).toContainEqual(expect.objectContaining({ itemId: "zone-a", kind: "overlap", message: "Overlaps Wall bays." }));
    expect(issues).toContainEqual(expect.objectContaining({ itemId: "zone-b", kind: "overlap", blockerId: "zone-a" }));
  });

  it("lets zones share an edge", () => {
    const layout = {
      ...store(),
      zones: [zone(), zone({ id: "zone-b", name: "Wall bays", points: rectangle(240, 0, 100, 100) })],
    };
    expect(validate(layout)).toEqual([]);
  });

  it("treats names that differ only by case or spacing as the same (Review Focus 4)", () => {
    const layout = {
      ...store(),
      zones: [zone(), zone({ id: "zone-b", name: "  front TABLES ", points: rectangle(240, 0, 100, 100) })],
    };
    expect(kinds(validate(layout), "zone-b")).toContain("duplicate-name");
  });

  it("flags a zone under 4 sq ft", () => {
    const layout = { ...store(), zones: [zone({ points: rectangle(0, 0, 20, 20) })] };
    expect(kinds(validate(layout), "zone-a")).toContain("too-small");
  });
});

describe("fixtures", () => {
  const withFaces = (layout: Layout): Layout => ({
    ...layout,
    faces: layout.fixtures
      .filter((f) => f.type === "table")
      .map((f) => face({ id: `face-${f.id}`, fixtureId: f.id })),
  });

  it("names what blocks an overlapping fixture", () => {
    const layout = withFaces({
      ...store(),
      fixtures: [fixture(), fixture({ id: "fixture-b", name: "Table 2", x: 340 })],
    });
    expect(validate(layout)).toContainEqual(
      expect.objectContaining({ itemId: "fixture-a", kind: "overlap", message: "Blocked by Table 2." }),
    );
  });

  it("lets a mannequin stand on a platform", () => {
    const layout = {
      ...store(),
      fixtures: [
        fixture({ id: "p", type: "platform", name: "Platform 1", width: 48, depth: 48 }),
        fixture({ id: "m", type: "mannequin", name: "Mannequin 1", width: 24, depth: 24 }),
      ],
    };
    expect(validate(layout)).toEqual([]);
  });

  it("flags a fixture outside the store", () => {
    const layout = withFaces({ ...store(), fixtures: [fixture({ x: 470 })] });
    expect(validate(layout)).toContainEqual(
      expect.objectContaining({ itemId: "fixture-a", kind: "outside-store", blockerId: OUTLINE_ID }),
    );
  });

  it("checks display sides against the fixture type", () => {
    const rackWithNone = { ...store(), fixtures: [fixture({ type: "rack", name: "Rack 1", width: 48, depth: 24 })] };
    expect(kinds(validate(rackWithNone), "fixture-a")).toContain("faces");

    const tableWithFront = { ...store(), fixtures: [fixture()], faces: [face(), face({ id: "f2", side: "front" })] };
    expect(validate(tableWithFront)).toContainEqual(
      expect.objectContaining({ kind: "faces", message: "Table 1 cannot display on its front." }),
    );
  });

  it("flags duplicate fixture names", () => {
    const layout = withFaces({
      ...store(),
      fixtures: [fixture(), fixture({ id: "fixture-b", name: " TABLE 1", x: 400 })],
    });
    expect(validate(layout)).toContainEqual(
      expect.objectContaining({ itemId: "fixture-b", kind: "duplicate-name", blockerId: "fixture-a" }),
    );
  });

  it("flags a grid over 24 ft wide", () => {
    const layout = { ...store(), fixtures: [fixture()], faces: [face({ columns: 49 })] };
    expect(kinds(validate(layout), "fixture-a")).toContain("grid");
  });

  it("allows one lower table per side only", () => {
    const layout = withFaces({
      ...store(),
      tableSets: [{ id: "set", upperFixtureId: "fixture-a", version: 1 }],
      fixtures: [
        fixture(),
        fixture({ id: "l1", name: "Table 1 · Front", y: 130, width: 72, depth: 24, tableSetId: "set", setSide: "front" }),
        fixture({ id: "l2", name: "Table 1 · Front 2", y: 160, width: 72, depth: 24, tableSetId: "set", setSide: "front" }),
      ],
    });
    expect(kinds(validate(layout), "l2")).toContain("table-set");
  });
});
