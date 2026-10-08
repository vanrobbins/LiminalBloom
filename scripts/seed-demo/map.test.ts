import { describe, expect, it } from "vitest";

import { normalize } from "@/lib/layout/normalize";
import { validate } from "@/lib/layout/validate";

import { demoMap } from "./map";

let n = 0;
const newId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

describe("demo map", () => {
  const { layout, faceKinds, stockroomZoneId } = demoMap(newId);

  it("is a map the editor would accept, already normalized", () => {
    expect(validate(layout)).toEqual([]);
    expect(normalize(layout)).toEqual(layout);
  });

  it("has the fixtures a real floor has", () => {
    const count = (type: string) => layout.fixtures.filter((f) => f.type === type).length;
    expect(count("wall_bay")).toBe(8);
    expect(count("rack")).toBe(8);
    expect(count("table")).toBeGreaterThanOrEqual(5);
    expect(count("mannequin")).toBe(2);
    expect(layout.tableSets).toHaveLength(1);
    expect(layout.entrances).toHaveLength(1);
    expect(layout.zones.find((z) => z.id === stockroomZoneId)?.type).toBe("stockroom");
  });

  it("gives racks two sides and knows each face's kind", () => {
    const rack = layout.fixtures.find((f) => f.name === "Rack 1")!;
    expect(layout.faces.filter((f) => f.fixtureId === rack.id).map((f) => f.side).sort()).toEqual(["back", "front"]);
    expect(new Set(faceKinds.values())).toEqual(new Set(["wall", "rack", "table"]));
    expect(faceKinds.size).toBe(layout.faces.length);
  });
});
