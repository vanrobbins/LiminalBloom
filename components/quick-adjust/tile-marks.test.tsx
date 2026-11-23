import { describe, expect, it } from "vitest";

import { emptying, entry, replacing } from "@/lib/planograms/test-adjust";

import { adjustItems, compareItems } from "./tile-marks";

const a = entry({ productId: "a", productName: "Straight jean", col: 0 });
const b = entry({ productId: "b", productName: "Tee", col: 2 });
const looks = { a: { imageKey: null, categoryName: "Denim", status: "sold_out" as const }, b: { imageKey: null, categoryName: "Tops" }, slim: { imageKey: "k", categoryName: "Denim", swatch: "#123456" } };

describe("adjustItems", () => {
  it("draws a replacement as itself in the original's place, marked with what it replaces, and takes the original's status mark off", () => {
    const slim = replacing(a, "slim", { replacement: { productId: "slim", productName: "Slim jean", styleNumber: "S-1", colSpan: 3, rowSpan: 2 } });
    const [first, second] = adjustItems([a, b], [slim], looks);
    expect(first).toMatchObject({ id: "v-0", productId: "slim", productName: "Slim jean", colSpan: 3, rowSpan: 2, imageKey: "k", swatch: "#123456", adjust: { kind: "replaced", from: "Straight jean" } });
    expect(first.status).toBeUndefined();
    expect(second).toMatchObject({ id: "v-1", productName: "Tee" });
    expect(second.adjust).toBeUndefined();
  });

  it("keeps a tile left empty, named for what it was, and marks an unchanged sold-out one", () => {
    const [first, second] = adjustItems([a, b], [emptying(b)], looks);
    expect(first).toMatchObject({ status: "sold_out" });
    expect(second).toMatchObject({ id: "v-1", adjust: { kind: "empty", was: "Tee" } });
  });
});

describe("compareItems", () => {
  it("outlines only what changed: the tile that goes on Before, its replacement on After, with the product it replaces", () => {
    const slim = { ...a, productId: "slim", productName: "Slim jean" };
    const { before, after } = compareItems([a, b], [slim, b], looks);
    expect(before.map((i) => i.adjust?.kind)).toEqual(["changed", undefined]);
    expect(after.map((i) => i.adjust)).toEqual([{ kind: "replaced", from: "Straight jean" }, undefined]);
  });

  it("an emptied tile is outlined on Before and has nothing on After", () => {
    const { before, after } = compareItems([a, b], [b], looks);
    expect(before.map((i) => i.adjust?.kind)).toEqual(["changed", undefined]);
    expect(after).toHaveLength(1);
  });
});
