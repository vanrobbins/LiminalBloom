// Random update / add / remove / undo / redo against a model of the draft: the
// stacks stay consistent with it (no step points at a placement that isn't
// there, or misses one that is), and undoing everything, then redoing it all,
// walks the draft back and forth without losing a placement.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import type { Change, PlacementFields, PlacementView } from "../types";

import { EMPTY_HISTORY, prune, record, redo, rename, undo, type History } from "./undo";

type Row = { id: string; productId: string; version: number; fields: PlacementFields };
type Model = { rows: Row[]; history: History; next: number };
const Op = fc.record({ op: fc.constantFrom("update", "add", "remove", "undo", "redo"), pick: fc.nat(20), col: fc.nat(10) });

const fieldsAt = (col: number): PlacementFields => ({ faceId: "f", presentation: "hung", col, row: 0, colSpan: 2, rowSpan: 1, pieceCount: 1, depth: 0 });
const views = (rows: readonly Row[]): PlacementView[] =>
  rows.map((r) => ({ ...r.fields, depth: r.fields.depth ?? 0, id: r.id, productId: r.productId, productName: "", styleNumber: "", imageKey: null, categoryName: "", version: r.version }));
const content = (rows: readonly Row[]) => rows.map((r) => JSON.stringify([r.productId, r.fields])).sort();

function applyChange(model: Model, change: Change): string | null {
  if (change.kind === "add") {
    const id = `p${model.next++}`;
    model.rows.push({ id, productId: change.productId, version: 1, fields: change.fields });
    return id;
  }
  const row = model.rows.find((r) => r.id === change.id);
  expect(row?.version).toBe(change.version);
  if (change.kind === "remove") model.rows = model.rows.filter((r) => r !== row);
  else if (row) Object.assign(row, { fields: change.fields, version: row.version + 1 });
  return null;
}

/** One undo or redo, as use-history does it. Returns false when there was nothing to step. */
function travel(model: Model, direction: "undo" | "redo"): boolean {
  const pruned = prune(model.history, views(model.rows));
  const step = (direction === "undo" ? undo : redo)(pruned, views(model.rows));
  if (!step) {
    model.history = pruned;
    return false;
  }
  const id = applyChange(model, step.change);
  model.history = id ? rename(step.history, step.step.id, id) : step.history;
  return true;
}

function run(model: Model, { op, pick, col }: { op: string; pick: number; col: number }) {
  const row = model.rows[pick % Math.max(model.rows.length, 1)];
  const size = model.history.done.length + model.history.undone.length;
  if (op === "undo" || op === "redo") {
    const before = model.history;
    const moved = travel(model, op);
    expect(model.history.done.length + model.history.undone.length).toBe(size);
    if (moved) expect(model.history.done.length).toBe(before.done.length + (op === "undo" ? -1 : 1));
  } else if (op === "add") {
    const productId = `prod${pick % 3}`;
    const change: Change = { kind: "add", productId, fields: fieldsAt(col) };
    const id = applyChange(model, change);
    if (id) model.history = record(model.history, { kind: "add", id, productId, fields: fieldsAt(col) });
  } else if (row && op === "update") {
    const change: Change = { kind: "update", id: row.id, version: row.version, fields: fieldsAt(col) };
    model.history = record(model.history, { kind: "update", id: row.id, before: row.fields, after: change.fields });
    applyChange(model, change);
  } else if (row) {
    model.history = record(model.history, { kind: "remove", id: row.id, productId: row.productId, fields: row.fields });
    applyChange(model, { kind: "remove", id: row.id, version: row.version });
  }
  // Nothing in either stack is orphaned: pruning finds nothing to drop.
  expect(prune(model.history, views(model.rows))).toEqual(model.history);
}

describe("undo history, over random sequences", () => {
  it("keeps done and undone consistent with the draft, and undo-all then redo-all round-trips", () => {
    fc.assert(
      fc.property(fc.array(Op, { maxLength: 40 }), (ops) => {
        const start: Row[] = [{ id: "s0", productId: "start", version: 1, fields: fieldsAt(0) }];
        const model: Model = { rows: structuredClone(start), history: EMPTY_HISTORY, next: 0 };
        ops.forEach((op) => run(model, op));

        while (travel(model, "redo"));
        const final = content(model.rows);
        while (travel(model, "undo"));
        expect(model.history.done).toEqual([]);
        expect(content(model.rows)).toEqual(content(start));
        while (travel(model, "redo"));
        expect(model.history.undone).toEqual([]);
        expect(content(model.rows)).toEqual(final);
      }),
      { numRuns: 300 },
    );
  });
});
