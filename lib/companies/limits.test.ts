import { describe, expect, it } from "vitest";

import { cleanCompanyName, cleanRegionName } from "./limits";

describe("cleanCompanyName", () => {
  it("trims and keeps 2 to 60 characters", () => {
    expect(cleanCompanyName("  Acme  ")).toBe("Acme");
    expect(cleanCompanyName("A")).toBeNull();
    expect(cleanCompanyName(" ".repeat(5))).toBeNull();
    expect(cleanCompanyName("a".repeat(60))).toBe("a".repeat(60));
    expect(cleanCompanyName("a".repeat(61))).toBeNull();
  });
});

describe("cleanRegionName", () => {
  it("trims and keeps 1 to 40 characters", () => {
    expect(cleanRegionName(" North ")).toBe("North");
    expect(cleanRegionName("  ")).toBeNull();
    expect(cleanRegionName("a".repeat(40))).not.toBeNull();
    expect(cleanRegionName("a".repeat(41))).toBeNull();
  });
});
