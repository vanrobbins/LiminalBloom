import { describe, expect, it } from "vitest";

import { cleanStoreName, MAX_STORE_NAME } from "./store-name-limits";

describe("cleanStoreName", () => {
  it("trims, and refuses a name under two or over 60 characters", () => {
    expect(cleanStoreName("  Pioneer Place  ")).toBe("Pioneer Place");
    expect(cleanStoreName("   ")).toBeNull();
    expect(cleanStoreName("A")).toBeNull();
    expect(cleanStoreName("AB")).toBe("AB");
    expect(cleanStoreName("x".repeat(MAX_STORE_NAME))).toHaveLength(MAX_STORE_NAME);
    expect(cleanStoreName("x".repeat(MAX_STORE_NAME + 1))).toBeNull();
  });
});
