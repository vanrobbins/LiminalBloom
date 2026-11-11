import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { RANK_STEP, rankBetween, renumberRanks } from "./rank";

describe("rankBetween", () => {
  it("takes the middle of a gap", () => {
    expect(rankBetween(100, 200)).toBe(150);
    expect(rankBetween(100, 102)).toBe(101);
  });

  it("says there is no gap when the ranks are neighbours", () => {
    expect(rankBetween(100, 101)).toBeNull();
    expect(rankBetween(200, 200)).toBeNull();
    expect(rankBetween(300, 200)).toBeNull();
  });

  it("returns null for bounds that are not whole numbers", () => {
    for (const [a, b] of [[NaN, 200], [100, NaN], [100, Infinity], [-Infinity, 200], [100.5, 200], [100, 200.5]] as const) {
      expect(rankBetween(a, b)).toBeNull();
    }
    expect(rankBetween(NaN, null)).toBeNull();
    expect(rankBetween(100.5, null)).toBeNull();
  });

  it("goes a full step below the last role when nothing is below", () => {
    expect(rankBetween(500, null)).toBe(500 + RANK_STEP);
  });

  it("returns a whole number strictly between its bounds, and finds one whenever one exists", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100000 }), fc.integer({ min: 1, max: 1000 }), (above, gap) => {
        const below = above + gap;
        const rank = rankBetween(above, below);
        return gap < 2 ? rank === null : rank !== null && Number.isInteger(rank) && rank > above && rank < below;
      }),
    );
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100000 }), (above) => {
        const rank = rankBetween(above, null);
        return rank !== null && Number.isInteger(rank) && rank > above;
      }),
    );
  });
});

describe("renumberRanks", () => {
  it("spaces the list evenly from the top rank, in the order given", () => {
    const ordered = [
      { id: "sm", rank: 100 },
      { id: "custom", rank: 101 },
      { id: "am", rank: 102 },
    ];
    expect(renumberRanks(ordered)).toEqual([
      { id: "sm", rank: 100 },
      { id: "custom", rank: 200 },
      { id: "am", rank: 300 },
    ]);
  });

  it("does not change its input and keeps every other field", () => {
    const ordered = [{ id: "a", rank: 7, name: "A" }];
    expect(renumberRanks(ordered)).toEqual([{ id: "a", rank: 100, name: "A" }]);
    expect(ordered[0].rank).toBe(7);
  });

  it("keeps the built-in roles' relative order and a Store Manager at 100 on top", () => {
    const ordered = [
      { id: "store_manager", rank: 100 },
      { id: "assistant_manager", rank: 200 },
      { id: "x", rank: 250 },
      { id: "vm_manager", rank: 300 },
      { id: "vm_worker", rank: 400 },
    ];
    const out = renumberRanks(ordered);
    expect(out[0]).toEqual({ id: "store_manager", rank: 100 });
    expect(out.map((r) => r.id)).toEqual(ordered.map((r) => r.id));
  });

  it("keeps order with strictly increasing, evenly spaced ranks", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 100000 }), { maxLength: 40 }), (ranks) => {
        const ordered = [...ranks].sort((a, b) => a - b).map((rank, i) => ({ id: i, rank }));
        const out = renumberRanks(ordered);
        return (
          out.length === ordered.length &&
          out.every((r, i) => r.id === i && r.rank === RANK_STEP * (i + 1)) &&
          out.every((r, i) => i === 0 || r.rank > out[i - 1].rank)
        );
      }),
    );
  });

  it("throws when the first item is not the lowest rank, so the list is not in rank order", () => {
    expect(() => renumberRanks([{ rank: 200 }, { rank: 100 }])).toThrow(/rank order/);
    expect(() => renumberRanks([{ rank: 100 }, { rank: 200 }])).not.toThrow();
    expect(renumberRanks([])).toEqual([]);
  });
});
