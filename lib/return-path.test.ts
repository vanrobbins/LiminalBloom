import { describe, expect, it } from "vitest";

import { authHref, safeReturnPath } from "./return-path";

describe("safeReturnPath", () => {
  it("keeps a path on this site, with its query", () => {
    expect(safeReturnPath("/invite/abc123")).toBe("/invite/abc123");
    expect(safeReturnPath("/products?q=shirt&page=2")).toBe("/products?q=shirt&page=2");
  });

  it("refuses anything that could leave the site", () => {
    const bad = ["https://evil.example/x", "//evil.example", "/\\evil.example", "\\\\evil.example", "/\\/evil.example", "javascript:alert(1)", "evil.example", "http:evil.example"];
    for (const value of bad) expect(safeReturnPath(value)).toBeNull();
  });

  it("refuses control characters, spaces, empty, missing and oversized values", () => {
    for (const bad of ["/a\nb", "/a\tb", "/a b", "/a\u0000b", "", null, undefined, `/${"a".repeat(600)}`]) {
      expect(safeReturnPath(bad)).toBeNull();
    }
  });

  it("refuses the sign-in and sign-up pages, which would loop", () => {
    expect(safeReturnPath("/sign-in")).toBeNull();
    expect(safeReturnPath("/sign-up?next=/x")).toBeNull();
    expect(safeReturnPath("/sign-installer")).toBe("/sign-installer");
  });
});

describe("authHref", () => {
  it("adds the return path to a sign-in or sign-up link, encoded", () => {
    expect(authHref("/sign-up", "/invite/abc")).toBe("/sign-up?next=%2Finvite%2Fabc");
  });

  it("leaves the link bare when there is nothing safe to return to", () => {
    expect(authHref("/sign-in", null)).toBe("/sign-in");
    expect(authHref("/sign-in", "//evil.example")).toBe("/sign-in");
  });
});
