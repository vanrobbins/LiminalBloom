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
  });

  it("covers a set's upper and lower tops, labelled by table", () => {
    const scope = planogramScope(layout, "upper");
    expect(scope?.isSet).toBe(true);
    expect(scope?.faces.map((f) => [f.faceId, f.label, f.setSide])).toEqual([
      ["u-top", "Upper", null],
      ["f-top", "Front table", "front"],
      ["l-top", "Left table", "left"],
    ]);
  });

  it("gives a lower table no scope of its own", () => {
    expect(planogramScope(layout, "low-f")).toBeNull();
  });
});
