// Undo through trash, tidy-up and another device's changes, step by step (DECISIONS 11-15).

import { describe, expect, it } from "vitest";

import { layerRanks } from "../layers";
import { depthsOf, fieldsOf, rowAt } from "../test-layers";

import { act, modelOf, save, travel } from "./test-model";
import { EMPTY_HISTORY, record } from "./undo";

const order = (model: ReturnType<typeof modelOf>) => [...layerRanks(model.rows)].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0])).map(([id]) => id);

describe("the exact sequence (0.7.0.5 task 2 re-review)", () => {
  // r0 is in front of everything; r2 and r3 share column 0; r1 sits right of that.
  const rows = [rowAt("r0", 0, 3, 0), rowAt("r2", 0, 1, 1), rowAt("r3", 0, 1, 2), rowAt("r1", 1, 3, 3)];

  it("edit r3, trash r0, Undo, Undo: both undos land, r3 is where its step left it", () => {
    const model = modelOf(rows);
    act(model, { kind: "update", id: "r3", version: 1, fields: { ...fieldsOf(rows[2]), pieceCount: 5 } });
    act(model, { kind: "remove", id: "r0", version: 1 });
    expect(depthsOf(model.rows)).toEqual({ r2: 1, r3: 2, r1: 3 });
    expect(travel(model, "undo")).toBe("done");
    expect(depthsOf(model.rows)).toMatchObject({ r2: 1, r3: 2, r1: 3 });
    expect(travel(model, "undo")).toBe("done");
    expect(model.rows.find((r) => r.id === "r3")?.pieceCount).toBe(1);
    expect(travel(model, "redo")).toBe("done");
    expect(travel(model, "redo")).toBe("done");
    expect(model.rows.find((r) => r.id === "r3")?.pieceCount).toBe(5);
  });

  it("a tile in front of the trashed one stays in front of it after Undo", () => {
    const layers = [rowAt("A", 4, 2, 0), rowAt("r0", 1, 4, 1), rowAt("B", 0, 2, 2), rowAt("C", 0, 1, 3)];
    const model = modelOf(layers);
    act(model, { kind: "remove", id: "r0", version: 1 });
    travel(model, "undo");
    const ranks = layerRanks(model.rows);
    const back = model.rows.find((r) => r.productId === "p-r0")!.id;
    expect(ranks.get("A")).toBeLessThan(ranks.get(back)!);
    expect(ranks.get(back)).toBeLessThan(ranks.get("B")!);
  });
});

describe("a rail pushed past 98", () => {
  // Three tiles on one span, the back two far apart: 0, 97, 98.
  const rows = [rowAt("a", 0, 4, 0), rowAt("b", 0, 4, 97), rowAt("c", 0, 4, 98)];
  const names = (model: ReturnType<typeof modelOf>) => order(model).map((id) => model.rows.find((r) => r.id === id)!.productId);

  it("is renumbered whole, keeping the order, and Undo and Redo across it land every tile in its layer", () => {
    const model = modelOf(rows);
    act(model, { kind: "remove", id: "b", version: 1 });
    act(model, { kind: "add", productId: "x", fields: { ...fieldsOf(rowAt("x", 0, 4, 0)), depth: undefined } });
    // Behind c, which is at 98: 99 doesn't fit, so every number is dealt out by place.
    expect(Object.values(depthsOf(model.rows)).sort()).toEqual([0, 1, 2]);
    expect(names(model)).toEqual(["p-a", "p-c", "x"]);
    expect(travel(model, "undo")).toBe("done"); // the add
    expect(travel(model, "undo")).toBe("done"); // the trash: b goes back between a and c
    expect(names(model)).toEqual(["p-a", "p-b", "p-c"]);
    expect(travel(model, "redo")).toBe("done");
    expect(travel(model, "redo")).toBe("done");
    expect(names(model)).toEqual(["p-a", "p-c", "x"]);
  });
});

describe("another device renumbers a tile", () => {
  it("your Undo of a step on that tile still works: edits to other tiles never refuse it", () => {
    const model = modelOf([rowAt("a", 0, 4, 0), rowAt("b", 0, 4, 1)]);
    act(model, { kind: "update", id: "b", version: 1, fields: { ...fieldsOf(model.rows[1]), pieceCount: 4 } });
    // The other device adds a tile between, which pushes b back a number (not through our history).
    save(model, { kind: "add", productId: "theirs", fields: { ...fieldsOf(rowAt("t", 0, 4, 0)), depth: 1 } }, "theirs");
    expect(model.rows.find((r) => r.id === "b")?.depth).toBe(2);
    expect(travel(model, "undo")).toBe("done");
    expect(model.rows.find((r) => r.id === "b")?.pieceCount).toBe(1);
  });

  it("but one that moved the tile itself forward or back is told: it no longer sits where the step left it", () => {
    const model = modelOf([rowAt("a", 0, 4, 0), rowAt("b", 0, 4, 1)]);
    act(model, { kind: "update", id: "b", version: 1, fields: { ...fieldsOf(model.rows[1]), pieceCount: 4 } });
    save(model, { kind: "update", id: "b", version: 2, fields: { ...fieldsOf(model.rows[1]), depth: 0 } }, "b");
    expect(travel(model, "undo")).toBe("refused");
  });

  it("a step for a tile another device trashed is dropped quietly", () => {
    const model = modelOf([rowAt("a", 0, 4, 0), rowAt("b", 0, 4, 1)]);
    act(model, { kind: "update", id: "b", version: 1, fields: { ...fieldsOf(model.rows[1]), pieceCount: 4 } });
    save(model, { kind: "remove", id: "b", version: 2 }, "x");
    expect(travel(model, "undo")).toBe("none");
    expect(model.history.done).toEqual([]);
  });
});

describe("an Undo whose anchor tiles are all gone (0.7.0.5 task 2 review)", () => {
  it("leaves the tile where it is instead of asking for its old number, which a tile in its group may hold now", () => {
    // T (front) has a step that remembers depth 1 behind tiles that have since been trashed; W holds 1 now.
    const model = modelOf([rowAt("T", 0, 4, 0), rowAt("W", 0, 4, 1), rowAt("V", 0, 4, 2)]);
    const now = fieldsOf(model.rows[0]);
    model.history = record(EMPTY_HISTORY, { kind: "update", id: "T", before: { ...now, pieceCount: 2, depth: 1 }, after: now, aheadBefore: { front: ["gone"], back: ["lost"], prev: "gone" } });
    expect(travel(model, "undo")).toBe("done");
    expect(model.rows.find((r) => r.id === "T")?.pieceCount).toBe(2);
    expect(depthsOf(model.rows)).toEqual({ T: 0, W: 1, V: 2 });
  });
});
