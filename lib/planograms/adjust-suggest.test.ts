import { describe, expect, it } from "vitest";

import { FACE, entry } from "./test-adjust";
import { MAX_SUGGESTIONS, suggestReplacements, type Candidate, type SuggestTarget } from "./adjust-suggest";
import type { PlanogramFace } from "./types";

const target = entry({ productId: "straight", col: 0, colSpan: 2, rowSpan: 2 });
const ask = (over: Partial<SuggestTarget> = {}): SuggestTarget => ({ entry: target, categoryId: "jeans", color: "Black", swatch: null, ...over });

function cand(id: string, over: Partial<Candidate> = {}, size = { columns: 2, rows: 2 }): Candidate {
  return { id, name: id, styleNumber: `N-${id}`, footprints: { hung: size, folded: size }, categoryId: "jeans", color: "Black", swatch: null, status: "in_stock", ...over };
}
const ids = (floor: Parameters<typeof suggestReplacements>[1], candidates: Candidate[], over: Partial<SuggestTarget> = {}, faces: PlanogramFace[] = [FACE]) =>
  suggestReplacements(ask(over), floor, faces, candidates).map((s) => s.product.id);
const neighbour = (col: number, over = {}) => entry({ productId: `n${col}`, productName: `N${col}`, col, ...over });

describe("who is eligible", () => {
  it("leaves out sold out products, and takes in stock and on sale", () => {
    expect(ids([target], [cand("a", { status: "sold_out" }), cand("b", { status: "on_sale" }), cand("c")])).toEqual(["b", "c"]);
  });

  it("leaves out a product already on this display, the target's own on-sale product among them", () => {
    const floor = [target, neighbour(6, { productId: "slim" })];
    expect(ids(floor, [cand("slim"), cand("straight", { status: "on_sale" }), cand("other")])).toEqual(["other"]);
  });

  it("leaves out other categories", () => {
    expect(ids([target], [cand("tee", { categoryId: "tees" }), cand("jean")])).toEqual(["jean"]);
  });

  it("takes the target's presentation footprint, not the other one's", () => {
    const big = cand("big");
    big.footprints = { hung: { columns: 1, rows: 1 }, folded: { columns: 3, rows: 2 } };
    expect(suggestReplacements(ask(), [target], [FACE], [big])[0]).toMatchObject({ colSpan: 3, rowSpan: 2 });
    const hung = entry({ presentation: "hung" });
    expect(suggestReplacements(ask({ entry: hung }), [hung], [FACE], [big])[0]).toMatchObject({ colSpan: 1, rowSpan: 1 });
  });
});

describe("what fits", () => {
  it("the target is out of the way first, so a product its own size fits where it was", () => {
    expect(ids([target], [cand("same")])).toEqual(["same"]);
  });

  it("may use open cells beside the target but never a neighbour's", () => {
    const floor = [target, neighbour(4)];
    expect(ids(floor, [cand("four", {}, { columns: 4, rows: 2 }), cand("five", {}, { columns: 5, rows: 2 })])).toEqual(["four"]);
    expect(ids([target, neighbour(2)], [cand("three", {}, { columns: 3, rows: 2 })])).toEqual([]);
  });

  it("refuses a product that runs off the face, and any when the face is gone", () => {
    expect(ids([target], [cand("tall", {}, { columns: 2, rows: 5 })])).toEqual([]);
    expect(ids([target], [cand("same")], {}, [])).toEqual([]);
  });

  it("on a frame rack, a hung product must stay in the rail's one row", () => {
    const rack: PlanogramFace = { ...FACE, fixtureType: "frame_rack", rows: 1 };
    const hung = entry({ presentation: "hung", rowSpan: 1 });
    const found = suggestReplacements(ask({ entry: hung }), [hung], [rack], [cand("flat", {}, { columns: 2, rows: 1 }), cand("deep", {}, { columns: 2, rows: 2 })]);
    expect(found.map((s) => s.product.id)).toEqual(["flat"]);
  });

  it("a hung product may share rail space with hung neighbours, but not take their layer", () => {
    const hung = entry({ presentation: "hung", colSpan: 2, rowSpan: 1, depth: 1 });
    const beside = neighbour(3, { presentation: "hung", colSpan: 2, rowSpan: 1, depth: 1 });
    const found = ids([hung, beside], [cand("over", {}, { columns: 4, rows: 1 }), cand("three", {}, { columns: 3, rows: 1 })], { entry: hung });
    expect(found).toEqual(["three"]);
    expect(ids([hung, { ...beside, depth: 0 }], [cand("over", {}, { columns: 4, rows: 1 })], { entry: hung })).toEqual(["over"]);
  });
});

describe("how they rank", () => {
  it("same category and colour comes before same category, however the names sort", () => {
    const found = suggestReplacements(ask(), [target], [FACE], [cand("a-navy", { color: "Navy" }), cand("z-black", { color: "Black" })]);
    expect(found.map((s) => [s.product.id, s.tier, s.reason])).toEqual([
      ["z-black", 1, "Same category and colour"],
      ["a-navy", 2, "Same category"],
    ]);
  });

  it("neutrals share a family at any hue: white matches black, but not red", () => {
    expect(suggestReplacements(ask(), [target], [FACE], [cand("white", { color: "White" })])[0].tier).toBe(1);
    expect(suggestReplacements(ask(), [target], [FACE], [cand("red", { color: "Red" })])[0].tier).toBe(2);
  });

  it("the swatch decides the family over the colour word", () => {
    const found = suggestReplacements(ask({ color: "Mystery", swatch: "#1f3a5c" }), [target], [FACE], [cand("denim", { color: "x", swatch: "#2a4a80" })]);
    expect(found[0].tier).toBe(1);
  });

  it("an unknown colour word matches nothing in tier 1 but is still same category", () => {
    const found = suggestReplacements(ask({ color: "Mauve-ish" }), [target], [FACE], [cand("a", { color: "Mauve-ish" })]);
    expect(found.map((s) => s.tier)).toEqual([2]);
  });

  it("within a tier the closest size comes first, then the name", () => {
    const sizes = { columns: 2, rows: 2 };
    const found = ids([target], [cand("tiny", {}, { columns: 1, rows: 1 }), cand("b", {}, sizes), cand("a", {}, sizes), cand("wide", {}, { columns: 3, rows: 2 })]);
    expect(found).toEqual(["a", "b", "wide", "tiny"]);
  });

  it("gives at most six", () => {
    const many = Array.from({ length: 9 }, (_, i) => cand(`p${i}`));
    expect(ids([target], many)).toHaveLength(MAX_SUGGESTIONS);
    expect(MAX_SUGGESTIONS).toBe(6);
  });

  it("gives nothing when nothing fits", () => {
    expect(ids([target], [])).toEqual([]);
  });
});
