import { describe, expect, it } from "vitest";

import { face, fixture } from "@/lib/layout/test-layouts";
import { EMPTY_LAYOUT, type Layout } from "@/lib/layout/types";

import { planogramList } from "./list";

const layout: Layout = {
  ...EMPTY_LAYOUT,
  zones: [{ id: "z1", name: "Denim", type: "display", color: "zone-1", points: [], version: 1 }],
  fixtures: [
    fixture({ id: "bay", type: "wall_bay", name: "Denim Wall · Bay 3", zoneId: "z1" }),
    fixture({ id: "upper", type: "table", name: "Front Table set", zoneId: null }),
    fixture({ id: "lower", type: "table", name: "", tableSetId: "set", setSide: "front" }),
    fixture({ id: "prop", type: "prop", name: "Plant" }),
  ],
  faces: [face({ id: "f1", fixtureId: "bay", side: "front" }), face({ id: "f2", fixtureId: "upper" }), face({ id: "f3", fixtureId: "lower" })],
  tableSets: [{ id: "set", upperFixtureId: "upper", version: 1 }],
};

describe("planogramList", () => {
  it("groups fixtures with faces by zone, zoneless last, lower tables hidden", () => {
    const groups = planogramList(layout, [{ fixtureId: "bay", publishedVersion: 4, publishedAt: new Date("2026-10-08T12:00:00Z"), hasDraft: true, dueDate: "2026-10-15" }]);
    expect(groups.map((g) => [g.zoneName, g.items.map((i) => i.name)])).toEqual([
      ["Denim", ["Denim Wall · Bay 3"]],
      ["Not in a zone", ["Front Table set"]],
    ]);
    expect(groups[0].items[0]).toMatchObject({ typeLabel: "Wall bay", publishedVersion: 4, hasDraft: true, dueDate: "2026-10-15" });
    expect(groups[1].items[0]).toMatchObject({ publishedVersion: null, hasDraft: false, dueDate: null });
  });
});
