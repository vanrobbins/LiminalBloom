import { describe, expect, it, vi } from "vitest";

vi.mock("@vercel/blob", () => ({ BlobNotFoundError: class extends Error {}, del: vi.fn(), get: vi.fn(), head: vi.fn(), list: vi.fn(), put: vi.fn() }));

import { withoutSeedImages } from "./images";

describe("withoutSeedImages", () => {
  it("drops shared seed images", () => {
    expect(withoutSeedImages(["stores/s/products/seed-0123456789abcdef.svg"])).toEqual([]);
  });

  it("keeps uploaded images", () => {
    const upload = "stores/s/products/6f1c2d3e-0000-4000-8000-000000000000-1a2b3c4d.webp";
    expect(withoutSeedImages([upload])).toEqual([upload]);
  });

  it("keeps a path where seed- is only in a directory", () => {
    const path = "stores/seed-shop/products/a-1a2b3c4d.webp";
    expect(withoutSeedImages([path])).toEqual([path]);
  });
});
