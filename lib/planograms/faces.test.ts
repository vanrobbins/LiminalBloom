import { describe, expect, it } from "vitest";

import { face, fixture } from "@/lib/layout/test-layouts";
import { EMPTY_LAYOUT, type Layout } from "@/lib/layout/types";

import { planogramOwner, planogramScope } from "./faces";

const rack = fixture({ id: "rack", type: "rack", name: "4-way Rack 2", tableSetId: null });
const upper = fixture({ id: "upper", type: "table", name: "Front Table set", tableSetId: null });
const front = fixture({ id: "low-f", type: "table", name: "", tableSetId: "set", setSide: "front" });
const left = fixture({ id: "low-l", type: "table", name: "", tableSetId: "set", setSide: "left" });

const layout: Layout = {
  ...EMPTY_LAYOUT,
  fixtures: [rack, upper, front, left],
  faces: [
    face({ id: "r-top", fixtureId: "rack", side: "right" }),
    face({ id: "r-front", fixtureId: "rack", side: "front" }),
    face({ id: "r-back", fixtureId: "rack", side: "back" }),
    face({ id: "u-top", fixtureId: "upper", side: "top" }),
    face({ id: "f-top", fixtureId: "low-f", side: "top", rows: 2 }),
    face({ id: "l-top", fixtureId: "low-l", side: "top", rows: 2 }),
  ],
  tableSets: [{ id: "set", upperFixtureId: "upper", version: 1 }],
};

describe("planogramOwner", () => {
  it("is the fixture itself, or a lower table's upper", () => {
    expect(planogramOwner(layout, "rack")?.id).toBe("rack");
    expect(planogramOwner(layout, "low-f")?.id).toBe("upper");
    expect(planogramOwner(layout, "nope")).toBeNull();
  });
});

describe("planogramScope", () => {
  it("lists only enabled faces, Front, Back, Left, Right, Top", () => {
    const scope = planogramScope(layout, "rack");
    expect(scope?.isSet).toBe(false);
    expect(scope?.faces.map((f) => f.label)).toEqual(["Front", "Back", "Right"]);
    expect(scope?.faces.every((f) => f.fixtureType === "rack")).toBe(true);
  });

  it("covers a set's upper and lower tops, labelled by table", () => {
    const scope = planogramScope(layout, "upper");
    expect(scope?.isSet).toBe(true);
    expect(scope?.faces.map((f) => [f.faceId, f.label, f.setSide])).toEqual([
      ["u-top", "Upper", null],
      ["f-top", "Front table", "front"],
      ["l-top", "Left table", "left"],
    ]);
    expect(scope?.faces.every((f) => f.fixtureType === "table")).toBe(true);
  });

  it("gives a lower table no scope of its own", () => {
    expect(planogramScope(layout, "low-f")).toBeNull();
  });
});

describe("frame rack runs", () => {
  const frame = (id: string, runIndex: number, x: number, y: number, rotation: number) =>
    fixture({ id, type: "frame_rack", name: `Frame ${id}`, x, y, width: 48, depth: 24, rotation, runId: "run", runIndex });
  // A closed square: a, then corners b, c, d.
  const square: Layout = {
    ...EMPTY_LAYOUT,
    fixtures: [frame("a", 0, 0, 0, 0), frame("b", 1, 24, 24, 90), frame("c", 2, 0, 48, 180), frame("d", 3, -24, 24, 270)],
    faces: ["a", "b", "c", "d"].map((id) => face({ id: `${id}-rail`, fixtureId: id, side: "front", columns: 8, rows: 1 })),
    frameRuns: [{ id: "run", startIndex: 0, version: 1 }],
  };

  it("belongs to the anchor: any rack opens the anchor's planogram", () => {
    expect(planogramOwner(square, "c")?.id).toBe("a");
    expect(planogramScope(square, "c")).toBeNull();
  });

  it("covers every rack's rail in reading order, naming corners", () => {
    const scope = planogramScope(square, "a")!;
    expect(scope).toMatchObject({ isSet: true, isRun: true });
    expect(scope.faces.map((f) => [f.faceId, f.label, f.fixtureType])).toEqual([
      ["a-rail", "Frame a · corner", "frame_rack"],
      ["b-rail", "Frame b · corner", "frame_rack"],
      ["c-rail", "Frame c · corner", "frame_rack"],
      ["d-rail", "Frame d · corner", "frame_rack"],
    ]);
  });

  it("marks the racks that turn a corner, and only those", () => {
    const straight: Layout = { ...square, fixtures: [frame("a", 0, 0, 0, 0), frame("b", 1, 48, 0, 0), frame("c", 2, 72, 24, 90)], faces: square.faces.slice(0, 3) };
    expect(planogramScope(straight, "a")!.faces.map((f) => f.corner ?? false)).toEqual([false, false, true]);
  });

  it("marks and names a rack back to back with the one before (run joins spec §1.3)", () => {
    const pair: Layout = { ...square, fixtures: [frame("a", 0, 0, 0, 0), frame("b", 1, 0, -24, 180)], faces: square.faces.slice(0, 2) };
    expect(planogramScope(pair, "a")!.faces.map((f) => [f.label, f.back ?? false, f.corner ?? false])).toEqual([
      ["Frame a", false, false],
      ["Frame b · back to back", true, false],
    ]);
  });

  it("starts reading where a closed run says", () => {
    const later = { ...square, frameRuns: [{ id: "run", startIndex: 2, version: 1 }] };
    expect(planogramScope(later, "a")!.faces.map((f) => f.faceId)).toEqual(["c-rail", "d-rail", "a-rail", "b-rail"]);
  });
});
