import { describe, expect, it } from "vitest";

import { escapeLike, storeQuery } from "./store-search";

describe("storeQuery", () => {
  it("trims, takes the first of a list and is empty when missing", () => {
    expect(storeQuery({ q: "  Pioneer " })).toBe("Pioneer");
    expect(storeQuery({ q: ["a", "b"] })).toBe("a");
    expect(storeQuery({})).toBe("");
  });
  it("caps the length at 100", () => {
    expect(storeQuery({ q: "x".repeat(500) })).toHaveLength(100);
  });
});

describe("escapeLike", () => {
  it("escapes the pattern characters", () => {
    expect(escapeLike("50%_off\\")).toBe("50\\%\\_off\\\\");
  });
});
