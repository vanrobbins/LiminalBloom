import { describe, expect, it } from "vitest";

import { cleanReason, MAX_REASON, MIN_REASON } from "./reason";

describe("cleanReason", () => {
  it("trims and accepts 5 to 500 characters", () => {
    expect(cleanReason("  Owner asked by phone  ")).toBe("Owner asked by phone");
    expect(cleanReason("a".repeat(MIN_REASON))).toHaveLength(MIN_REASON);
    expect(cleanReason("a".repeat(MAX_REASON))).toHaveLength(MAX_REASON);
  });
  it("refuses short, long, blank and non-text values", () => {
    expect(cleanReason("a".repeat(MIN_REASON - 1))).toBeNull();
    expect(cleanReason("   abc   ")).toBeNull();
    expect(cleanReason("a".repeat(MAX_REASON + 1))).toBeNull();
    for (const bad of [undefined, null, 12345, {}, ["reason"]]) expect(cleanReason(bad)).toBeNull();
  });
});
