// Random shared-rail layouts and random adds, removes, moves, reorders, undos and redos, as the draft
// and the history handle them (steps say which tile they were behind): no Undo is ever refused over a
// layer, and undoing everything puts every layer back in order.
// Also: trash a tile then bring it back with its own fields, and every depth is as it was.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { layersAfter } from "../layer-depths";
import { reorderTarget, sharesSpace } from "../layers";
import { depthsOf, fieldsOf, rowAt, serve, type Row } from "../test-layers";

import { act, modelOf, travel, type Model } from "./test-model";

const Op = fc.record({ op: fc.constantFrom("add", "remove", "move", "forward", "back", "undo", "redo"), pick: fc.nat(30), col: fc.nat(7), span: fc.integer({ min: 1, max: 4 }) });
const Start = fc.array(fc.record({ col: fc.nat(7), span: fc.integer({ min: 1, max: 4 }) }), { minLength: 1, maxLength: 8 });

const start = (cells: { col: number; span: number }[], base: number): Row[] => {
  let rows: Row[] = [];
  cells.forEach(({ col, span }, i) => {
    rows = serve(rows, { kind: "add", productId: `p${i}`, fields: { ...fieldsOf(rowAt("x", col, span, 0)), depth: undefined } }, `s${i}`);
  });
  return rows.map((r) => ({ ...r, depth: r.depth + base }));
};

const alive = (model: Model, direction: "undo" | "redo") => {
  const result = travel(model, direction);
  // One device: a refusal over a layer (or anything) would be a false "Changed on another device".
  expect(result).not.toBe("refused");
  return result === "done";
};

function run(model: Model, { op, pick, col, span }: { op: string; pick: number; col: number; span: number }) {
  const row = model.rows[pick % Math.max(model.rows.length, 1)];
  if (op === "undo" || op === "redo") return void alive(model, op);
  if (op === "add") act(model, { kind: "add", productId: `q${model.next}`, fields: { ...fieldsOf(rowAt("x", col, span, 0)), depth: undefined } });
  else if (row && op === "remove") act(model, { kind: "remove", id: row.id, version: row.version });
  else if (row) {
    const depth = op === "move" ? undefined : (reorderTarget(row, model.rows, op === "forward" ? "forward" : "back") ?? undefined);
    if (op === "move" || depth !== undefined) act(model, { kind: "update", id: row.id, version: row.version, fields: { ...fieldsOf(row), ...(op === "move" ? { col, colSpan: span } : {}), depth } });
  }
}

/** What a person sees: for every two tiles that overlap, which is in front. */
const order = (rows: readonly Row[]) =>
  rows
    .flatMap((a) => rows.filter((b) => a.productId < b.productId && sharesSpace(a, b)).map((b) => `${a.productId}${a.depth < b.depth ? "<" : ">"}${b.productId}`))
    .sort();
const cells = (rows: readonly Row[]) => rows.map((r) => `${r.productId}@${r.col}+${r.colSpan}`).sort();

describe("layers across undo, over random sequences", () => {
  it("no Undo or Redo is refused over a layer; undoing everything restores every product's place, redoing it all restores the end", () => {
    fc.assert(
      fc.property(Start, fc.nat(90), fc.array(Op, { maxLength: 40 }), (layout, base, ops) => {
        const begin = start(layout, base);
        const model = modelOf(begin);
        ops.forEach((o) => run(model, o));
        while (alive(model, "redo"));
        const end = { cells: cells(model.rows), order: order(model.rows) };
        while (alive(model, "undo"));
        expect(model.history.done).toEqual([]);
        expect(cells(model.rows)).toEqual(cells(begin));
        expect(order(model.rows)).toEqual(order(begin));
        while (alive(model, "redo"));
        expect({ cells: cells(model.rows), order: order(model.rows) }).toEqual(end);
      }),
      { numRuns: 500 },
    );
  });

  it("trash a tile and bring it back with its own fields: every depth is as it was", () => {
    fc.assert(
      fc.property(Start, fc.nat(90), fc.nat(10), (layout, base, pick) => {
        const rows = start(layout, base);
        const gone = rows[pick % rows.length];
        const removed = serve(rows, { kind: "remove", id: gone.id, version: 1 });
        const back = serve(removed, { kind: "add", productId: gone.productId, fields: fieldsOf(gone) }, gone.id);
        expect(depthsOf(back)).toEqual(depthsOf(rows));
        expect(layersAfter(rows, { kind: "remove", id: gone.id, version: 1 }).others).toEqual([]);
      }),
      { numRuns: 500 },
    );
  });
});
