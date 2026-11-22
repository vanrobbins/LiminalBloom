import { describe, expect, it } from "vitest";

import { entrance, face, fixture, rectangle, store, zone } from "./test-layouts";
import { OUTLINE_ID, type Fixture, type Issue, type Layout } from "./types";
import { newIssues, validate } from "./validate";

const kinds = (issues: Issue[], itemId: string) => issues.filter((i) => i.itemId === itemId).map((i) => i.kind);

describe("lower tables added later", () => {
  const base = (): Layout => ({
    ...store(),
    tableSets: [{ id: "set", upperFixtureId: "fixture-a", version: 1 }],
    fixtures: [
      fixture(),
      fixture({ id: "m-old", name: "Table 1 · Front", y: 130, depth: 24, tableSetId: "set", setSide: "front" }),
    ],
    faces: [face()],
  });

  it("blocks a second lower on one side even when its id sorts first", () => {
    const before = validate(base());
    const after = {
      ...base(),
      fixtures: [
        ...base().fixtures,
        fixture({ id: "a-new", name: "Table 1 · Front 2", y: 160, depth: 24, tableSetId: "set", setSide: "front" }),
      ],
    };
    const changed = new Set(["a-new"]);
    const found = validate(after, changed);
    expect(found).toContainEqual(expect.objectContaining({ itemId: "a-new", kind: "table-set", blockerId: "m-old" }));
    expect(newIssues(before, validate(after), changed).map((i) => i.kind)).toContain("table-set");
  });
});

describe("entrances", () => {
  it("flags one off the wall", () => {
    const layout = { ...store(), entrances: [entrance({ y: 300 })] };
    expect(kinds(validate(layout), "entrance-a")).toContain("off-wall");
  });

  it("flags two that overlap on one wall", () => {
    const layout = { ...store(), entrances: [entrance(), entrance({ id: "entrance-b", x: 260 })] };
    expect(kinds(validate(layout), "entrance-b")).toContain("overlap");
  });
});

describe("only", () => {
  it("checks just the named items, plus pairs that include them", () => {
    const layout = {
      ...store(),
      zones: [zone({ points: rectangle(0, 0, 20, 20) }), zone({ id: "zone-b", name: "Wall bays", points: rectangle(300, 0, 100, 100) })],
    };
    expect(validate(layout, new Set(["zone-b"]))).toEqual([]);
  });

  it("flags the wanted item of an overlapping pair", () => {
    const layout = {
      ...store(),
      zones: [zone(), zone({ id: "zone-b", name: "Wall bays", points: rectangle(200, 0, 100, 100) })],
    };
    const issues = validate(layout, new Set(["zone-b"]));
    expect(issues).toContainEqual(expect.objectContaining({ itemId: "zone-b", kind: "overlap", blockerId: "zone-a" }));
  });

  it("checks everything when the outline is among them", () => {
    const layout = { ...store(), zones: [zone({ points: rectangle(400, 0, 200, 100) })] };
    expect(validate(layout, new Set([OUTLINE_ID]))).not.toEqual([]);
  });
});

describe("newIssues", () => {
  it("ignores problems that were already there", () => {
    const old: Issue = { itemId: "a", kind: "overlap", message: "x", blockerId: "b" };
    expect(newIssues([old], [old], new Set(["a"]))).toEqual([]);
  });

  it("reports a new problem on a changed item, or caused by one", () => {
    const fresh: Issue = { itemId: "b", kind: "outside-store", message: "x", blockerId: OUTLINE_ID };
    expect(newIssues([], [fresh], new Set([OUTLINE_ID]))).toEqual([fresh]);
    expect(newIssues([], [fresh], new Set(["c"]))).toEqual([]);
  });
});

describe("curved wall bays", () => {
  const bay = (over: Partial<Fixture>) =>
    fixture({ id: "bay", type: "wall_bay", name: "Curved wall", x: 240, y: 180, width: 120, depth: 24, ...over });
  const withBay = (over: Partial<Fixture>, others: Fixture[] = []) => ({
    ...store(),
    fixtures: [bay(over), ...others],
    faces: [face({ id: "bay-front", fixtureId: "bay", side: "front" as const, columns: 20, rows: 5 })],
  });
  const bayKinds = (layout: Layout) => kinds(validate(layout), "bay");

  it("accepts a curve within the limit, either way", () => {
    expect(bayKinds(withBay({ curve: 30 }))).toEqual([]);
    expect(bayKinds(withBay({ curve: -30 }))).toEqual([]);
  });

  it("refuses a curve past the limit and says what the limit is", () => {
    const issues = validate(withBay({ curve: 39 })).filter((i) => i.kind === "curve");
    expect(issues).toEqual([{ itemId: "bay", kind: "curve", message: "Curved wall can curve at most 3′ 2″ at this size." }]);
  });

  it("refuses a curve on anything but a wall bay", () => {
    const layout = { ...store(), fixtures: [fixture({ id: "t", x: 240, y: 180, curve: 6 })], faces: [face({ fixtureId: "t" })] };
    expect(validate(layout).map((i) => i.message)).toContain("A table can't curve.");
  });

  it("checks containment by the band", () => {
    expect(bayKinds(withBay({ y: 30, depth: 12, curve: -38 }))).toContain("outside-store");
  });

  it("says why a bay flat on a wall can't bend backward", () => {
    const refusal = (over: Partial<Fixture>) => validate(withBay(over)).find((i) => i.kind === "outside-store")?.message;
    expect(refusal({ y: 12, curve: 0 })).toBeUndefined();
    expect(refusal({ y: 12, curve: -20 })).toBe("Curved wall bends past the wall. Move it forward, or flip the curve.");
    expect(refusal({ y: -40, curve: -20 })).toBe("Curved wall is outside the store.");
  });

  it("checks overlap by the band: the pocket of a curve is free floor", () => {
    const table = fixture({ id: "t", x: 240, y: 180, width: 30, depth: 30 });
    expect(bayKinds(withBay({ curve: -38 }, [table]))).not.toContain("overlap");
    const onBand = fixture({ id: "t", x: 240, y: 142, width: 30, depth: 30 });
    expect(bayKinds(withBay({ curve: -38 }, [onBand]))).toContain("overlap");
  });
});
