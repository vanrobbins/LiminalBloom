import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { applyAdjustment, targetKey, type AdjustChange } from "./adjust";
import { FACE, emptying, entry, replacing } from "./test-adjust";
import { suggestReplacements, type Candidate } from "./adjust-suggest";
import { sharesSpace } from "./layers";
import { checkPlacement } from "./rules";
import type { SnapshotEntry } from "./types";

type Rect = { col: number; row: number; w: number; h: number; hung: boolean };
const rect = fc.record({ col: fc.nat(11), row: fc.nat(3), w: fc.integer({ min: 1, max: 4 }), h: fc.integer({ min: 1, max: 2 }), hung: fc.boolean() });
const overlap = (a: SnapshotEntry, b: SnapshotEntry) => a.col < b.col + b.colSpan && b.col < a.col + a.colSpan && a.row < b.row + b.rowSpan && b.row < a.row + a.rowSpan;

/** A valid floor: every rectangle that fits the face and meets no earlier one, except hung over hung (each on its own layer). */
function floorOf(rects: Rect[]): SnapshotEntry[] {
  const placed: SnapshotEntry[] = [];
  for (const r of rects) {
    const e = entry({ productId: `p${placed.length}`, productName: `P${placed.length}`, col: r.col, row: r.row, colSpan: r.w, rowSpan: r.h, presentation: r.hung ? "hung" : "folded", depth: placed.length });
    const fits = e.col + e.colSpan <= FACE.columns && e.row + e.rowSpan <= FACE.rows;
    if (fits && !placed.some((o) => overlap(e, o) && !(e.presentation === "hung" && o.presentation === "hung"))) placed.push(e);
  }
  return placed;
}

const candidate = fc.record({ w: fc.integer({ min: 1, max: 5 }), h: fc.integer({ min: 1, max: 3 }), status: fc.constantFrom("in_stock", "sold_out", "on_sale" as const), color: fc.constantFrom("Black", "Navy", "White", "Red") });
const toCandidates = (list: { w: number; h: number; status: Candidate["status"]; color: string }[]): Candidate[] =>
  list.map((c, i) => ({ id: `c${i}`, name: `C${i}`, styleNumber: `S${i}`, footprints: { hung: { columns: c.w, rows: c.h }, folded: { columns: c.w, rows: c.h } }, categoryId: "jeans", color: c.color, swatch: null, status: c.status }));

describe("applyAdjustment properties", () => {
  it("dropping every change gives the snapshot back, and applying never edits the snapshot", () => {
    fc.assert(
      fc.property(fc.array(rect, { maxLength: 8 }), fc.array(fc.nat(2), { maxLength: 8 }), (rects, picks) => {
        const snapshot = floorOf(rects);
        const before = structuredClone(snapshot);
        const changes: AdjustChange[] = snapshot.flatMap((e, i) => (picks[i] === 1 ? [emptying(e)] : picks[i] === 2 ? [replacing(e, `r${i}`)] : []));
        const { entries, skipped } = applyAdjustment(snapshot, changes);
        expect(skipped).toBe(0);
        expect(entries).toHaveLength(snapshot.length - picks.slice(0, snapshot.length).filter((p) => p === 1).length);
        expect(snapshot).toEqual(before);
        expect(applyAdjustment(snapshot, []).entries).toEqual(snapshot);
      }),
    );
  });
});

describe("an adjusted floor built from suggestions", () => {
  it("never fails the placement rules, and no hung layer is shared", () => {
    fc.assert(
      fc.property(fc.array(rect, { maxLength: 8 }), fc.array(fc.nat(2), { maxLength: 8 }), fc.array(candidate, { maxLength: 8 }), (rects, picks, list) => {
        const snapshot = floorOf(rects);
        const pool = toCandidates(list);
        const changes: AdjustChange[] = [];
        snapshot.forEach((e, i) => {
          if (picks[i] === 1) changes.push(emptying(e));
          if (picks[i] !== 2) return;
          // Each choice is made against the floor so far, as the screen does it.
          const [first] = suggestReplacements({ entry: e, categoryId: "jeans", color: "Black", swatch: null }, applyAdjustment(snapshot, changes).entries, [FACE], pool);
          if (first) changes.push(replacing(e, first.product.id, { replacement: { productId: first.product.id, productName: first.product.name, styleNumber: first.product.styleNumber, colSpan: first.colSpan, rowSpan: first.rowSpan } }));
        });
        const { entries } = applyAdjustment(snapshot, changes);
        const rows = entries.map((e) => ({ ...e, id: targetKey(e) }));
        for (const row of rows) {
          expect(checkPlacement(row, rows, [FACE])).toBeNull();
          expect(rows.some((o) => sharesSpace(row, o) && (o.depth ?? 0) === (row.depth ?? 0))).toBe(false);
        }
        expect(changes.map((c) => targetKey(c.target))).toEqual([...new Set(changes.map((c) => targetKey(c.target)))]);
      }),
    );
  });
});
