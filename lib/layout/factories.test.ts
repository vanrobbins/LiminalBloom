import { describe, expect, it } from "vitest";

import { baseName, findFreeSpot, leastUsedColor, newFixture, nextName } from "./factories";
import { store, zone } from "./test-layouts";

describe("nextName", () => {
  it("counts past the highest number, ignoring case and spacing", () => {
    expect(nextName(["Table 1", " table 3 ", "Rack 9"], "Table")).toBe("Table 4");
    expect(nextName([], "Wall bay")).toBe("Wall bay 1");
  });
});

describe("baseName", () => {
  it("drops a trailing number", () => {
    expect(baseName("Table 12")).toBe("Table");
    expect(baseName("Front window")).toBe("Front window");
  });
});

describe("leastUsedColor", () => {
  it("picks a colour no zone uses yet", () => {
    expect(leastUsedColor([zone({ color: "zone-1" }), zone({ color: "zone-2" })])).toBe("zone-3");
  });
});

describe("newFixture", () => {
  it("makes a rack with its front face and the next free name", () => {
    let n = 0;
    const { fixture, faces } = newFixture(store(), "rack", "r", { x: 100.4, y: 99.6 }, () => `id-${++n}`);
    expect(fixture).toMatchObject({ id: "r", name: "Rack 1", x: 100, y: 100, width: 48, depth: 24, rotation: 0 });
    expect(faces).toEqual([{ id: "id-1", fixtureId: "r", side: "front", columns: 4, rows: 3, version: 0 }]);
  });
});

describe("findFreeSpot", () => {
  it("returns the centre when it fits", () => {
    expect(findFreeSpot({ x: 10, y: 10 }, 100, () => true)).toEqual({ x: 10, y: 10 });
  });

  it("searches outward to the nearest spot that fits", () => {
    const spot = findFreeSpot({ x: 0, y: 0 }, 200, (p) => p.x >= 40);
    expect(spot).not.toBeNull();
    expect(spot!.x).toBeGreaterThanOrEqual(40);
    expect(Math.hypot(spot!.x, spot!.y)).toBeLessThanOrEqual(48);
  });

  it("gives up beyond the radius", () => {
    expect(findFreeSpot({ x: 0, y: 0 }, 50, () => false)).toBeNull();
  });
});
