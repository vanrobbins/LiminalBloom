import { describe, expect, it } from "vitest";

import { uuidParam, withoutParam } from "./url-params";

const ID = "3f0f6a1e-6d1e-4c6a-9a45-6d1b0c4d9a10";

describe("uuidParam", () => {
  it("returns a well-formed id", () => {
    expect(uuidParam({ zone: ID }, "zone")).toBe(ID);
  });

  it("takes the first of a repeated param", () => {
    expect(uuidParam({ zone: [ID, "x"] }, "zone")).toBe(ID);
  });

  it("drops anything that is not an id, and a missing param", () => {
    expect(uuidParam({ zone: "not-an-id" }, "zone")).toBeUndefined();
    expect(uuidParam({}, "zone")).toBeUndefined();
    expect(uuidParam({ zone: [] }, "zone")).toBeUndefined();
  });
});

describe("withoutParam", () => {
  it("removes the param and keeps the rest", () => {
    expect(withoutParam("/products?q=tee&open=abc&status=sold_out", "open")).toBe("/products?q=tee&status=sold_out");
  });

  it("leaves the bare path when it was the only param", () => {
    expect(withoutParam("/layout?zone=abc", "zone")).toBe("/layout");
  });

  it("returns null when the param is not there, so the URL is left alone", () => {
    expect(withoutParam("/products?q=tee", "open")).toBeNull();
    expect(withoutParam("/products", "open")).toBeNull();
  });
});
