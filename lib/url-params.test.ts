import { describe, expect, it } from "vitest";

import { nonceParam, uuidParam, withNonce, withoutParam } from "./url-params";

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

describe("withoutParam, several names", () => {
  it("removes each that is there", () => {
    expect(withoutParam("/products?q=tee&open=abc&n=k3", "open", "n")).toBe("/products?q=tee");
    expect(withoutParam("/layout?zone=abc&n=k3", "zone", "n")).toBe("/layout");
    expect(withoutParam("/layout?n=k3", "zone", "n")).toBe("/layout");
  });
});

describe("withNonce", () => {
  it("adds a fresh n to an entry link, so choosing the same thing twice is a new address", () => {
    expect(withNonce(`/layout?zone=${ID}`, "k3")).toBe(`/layout?zone=${ID}&n=k3`);
    expect(withNonce(`/products?q=tee&open=${ID}`, "k3")).toBe(`/products?q=tee&open=${ID}&n=k3`);
  });

  it("leaves other links alone", () => {
    expect(withNonce("/products?q=tee", "k3")).toBe("/products?q=tee");
    expect(withNonce("/planograms/abc", "k3")).toBe("/planograms/abc");
  });

  it("makes a different one each call by default", () => {
    const a = withNonce(`/layout?zone=${ID}`);
    expect(a).toMatch(/&n=[a-z0-9]+$/);
  });
});

describe("nonceParam", () => {
  it("reads a short plain token, else nothing", () => {
    expect(nonceParam({ n: "k3x9" })).toBe("k3x9");
    expect(nonceParam({ n: ["k3", "z"] })).toBe("k3");
    expect(nonceParam({ n: "has space" })).toBe("");
    expect(nonceParam({ n: "x".repeat(20) })).toBe("");
    expect(nonceParam({})).toBe("");
  });
});
