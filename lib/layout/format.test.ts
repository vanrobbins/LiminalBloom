import { describe, expect, it } from "vitest";

import { entranceLabel, formatArea, formatLength } from "./format";
import { EMPTY_LAYOUT } from "./types";

describe("formatLength", () => {
  it("writes feet and inches", () => {
    expect(formatLength(76)).toBe("6′ 4″");
    expect(formatLength(72)).toBe("6′");
    expect(formatLength(8)).toBe("8″");
    expect(formatLength(0)).toBe("0″");
  });

  it("handles negative values and near-zero rounding", () => {
    expect(formatLength(-0.3)).toBe("0″");
    expect(formatLength(-8)).toBe("−8″");
  });
});

describe("formatArea", () => {
  it("writes square feet", () => {
    expect(formatArea(144 * 120)).toBe("120 sq ft");
  });
});

describe("entranceLabel", () => {
  it("numbers entrances in order", () => {
    const layout = {
      ...EMPTY_LAYOUT,
      entrances: [
        { id: "a", x: 0, y: 0, width: 72, version: 0 },
        { id: "b", x: 0, y: 0, width: 72, version: 0 },
      ],
    };
    expect(entranceLabel(layout, "b")).toBe("Entrance 2");
  });
});
