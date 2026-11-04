import { describe, expect, it } from "vitest";

import { apply } from "./commands";
import { chainOrder, openEnds, removalRefusal, runRacks } from "./commands-runs";
import { runShape } from "./runs";
import { face, fixture, store } from "./test-layouts";
import type { Layout } from "./types";
import { validate } from "./validate";

let n = 0;
const newId = () => `id-${++n}`;

const frame = (id: string, x: number, y = 120, rotation = 0) =>
  fixture({ id, type: "frame_rack", name: id, x, y, width: 48, depth: 24, rotation });
const rail = (fixtureId: string) => face({ id: `${fixtureId}-face`, fixtureId, side: "front", columns: 8, rows: 1 });

function layoutWith(...racks: ReturnType<typeof frame>[]): Layout {
  return { ...store(), fixtures: racks, faces: racks.map((r) => rail(r.id)) };
}

const shapeOf = (layout: Layout, runId: string) => runShape(runRacks(layout, runId).map((f) => ({ ...f, runIndex: f.runIndex ?? 0 })));

describe("addRackToRun", () => {
  it("starts a run with a straight rack at either end of a rack on its own", () => {
    const right = apply(layoutWith(frame("a", 100)), { type: "addRackToRun", rackId: "a", side: "right" }, newId);
    const run = right.frameRuns[0];
    expect(right.fixtures.map((f) => [f.type, f.runId, f.runIndex, f.x, f.y])).toEqual([
      ["frame_rack", run.id, 0, 100, 120],
      ["frame_rack", run.id, 1, 148, 120],
    ]);
    expect(right.faces.at(-1)).toMatchObject({ side: "front", rows: 1, columns: 8 });

    const left = apply(layoutWith(frame("a", 100)), { type: "addRackToRun", rackId: "a", side: "left" }, newId);
    const added = left.fixtures.find((f) => f.id !== "a")!;
    expect(added).toMatchObject({ runIndex: 0, x: 52 });
    expect(left.fixtures.find((f) => f.id === "a")).toMatchObject({ runIndex: 1 });
  });

  it("adds only at a run's open ends, and stops at six", () => {
    let layout = layoutWith(frame("a", 60));
    for (let i = 0; i < 5; i++) {
      const last = layout.fixtures.at(-1)!;
      layout = apply(layout, { type: "addRackToRun", rackId: last.id, side: "right" }, newId);
    }
    expect(layout.fixtures).toHaveLength(6);
    expect(openEnds(layout, layout.fixtures.at(-1)!.id)).toEqual({ left: false, right: false });
    const middle = layout.fixtures[2];
    expect(apply(layout, { type: "addRackToRun", rackId: middle.id, side: "right" }, newId)).toBe(layout);
  });
});

describe("runs move, turn and snap as one", () => {
  const twoRun = () => apply(layoutWith(frame("a", 100)), { type: "addRackToRun", rackId: "a", side: "right" }, newId);

  it("moves the whole run when one rack moves", () => {
    const layout = twoRun();
    const moved = apply(layout, { type: "move", ids: [layout.fixtures[1].id], delta: { x: 10, y: 20 } }, newId);
    expect(moved.fixtures.map((f) => [f.x, f.y])).toEqual([
      [110, 140],
      [158, 140],
    ]);
  });

  it("turns the whole run when the anchor turns, and makes a corner when another rack turns", () => {
    const layout = twoRun();
    const runId = layout.frameRuns[0].id;
    const turned = apply(layout, { type: "updateFixture", id: "a", changes: { rotation: 90 } }, newId);
    expect(turned.fixtures.map((f) => f.rotation)).toEqual([90, 90]);
    expect(shapeOf(turned, runId).joins).toEqual(["straight"]);

    const corner = apply(layout, { type: "updateFixture", id: layout.fixtures[1].id, changes: { rotation: 88 } }, newId);
    expect(corner.fixtures[1].rotation).toBe(90);
    expect(shapeOf(corner, runId).joins).toEqual(["corner"]);
  });

  it("re-snaps the racks after one whose width changes", () => {
    const layout = twoRun();
    const wider = apply(layout, { type: "updateFixture", id: "a", changes: { width: 72 } }, newId);
    expect(wider.fixtures[1].x).toBe(100 + 36 + 24);
  });
});

describe("removeFromRun", () => {
  const threeRun = () => {
    const layout = apply(layoutWith(frame("a", 100)), { type: "addRackToRun", rackId: "a", side: "right" }, newId);
    return apply(layout, { type: "addRackToRun", rackId: layout.fixtures[1].id, side: "right" }, newId);
  };

  it("refuses a middle rack of an open run", () => {
    const layout = threeRun();
    expect(removalRefusal(layout, layout.fixtures[1].id)).toBe("Remove an end rack first.");
    expect(apply(layout, { type: "removeFromRun", rackId: layout.fixtures[1].id }, newId)).toBe(layout);
  });

  it("takes the anchor out, steps it forward, and the next rack becomes the anchor", () => {
    const layout = threeRun();
    const [, b, c] = layout.fixtures;
    const out = apply(layout, { type: "removeFromRun", rackId: "a" }, newId);
    const a = out.fixtures.find((f) => f.id === "a")!;
    expect(a).toMatchObject({ runId: null, runIndex: null, y: 132 });
    expect(out.fixtures.find((f) => f.id === b.id)?.runIndex).toBe(0);
    expect(out.fixtures.find((f) => f.id === c.id)?.runIndex).toBe(1);
  });

  it("dissolves a run left with one rack", () => {
    const layout = apply(layoutWith(frame("a", 100)), { type: "addRackToRun", rackId: "a", side: "right" }, newId);
    const out = apply(layout, { type: "removeFromRun", rackId: "a" }, newId);
    expect(out.frameRuns).toEqual([]);
    expect(out.fixtures.every((f) => f.runId === null && f.runIndex === null)).toBe(true);
  });
});

describe("linkRun", () => {
  it("links racks in the order they make on the floor", () => {
    const layout = layoutWith(frame("c", 196), frame("a", 100), frame("b", 148));
    expect(chainOrder(layout.fixtures)).toEqual(["a", "b", "c"]);
    const linked = apply(layout, { type: "linkRun", ids: ["c", "a", "b"] }, newId);
    expect(linked.fixtures.map((f) => [f.id, f.runIndex])).toEqual([
      ["c", 2],
      ["a", 0],
      ["b", 1],
    ]);
  });

  it("snaps racks that don't touch into a straight line, in selected order", () => {
    const layout = layoutWith(frame("a", 100, 120), frame("b", 300, 200));
    const linked = apply(layout, { type: "linkRun", ids: ["a", "b"] }, newId);
    expect(linked.fixtures.find((f) => f.id === "b")).toMatchObject({ runIndex: 1, x: 148, y: 120 });
  });

  it("links only frame racks that are in no run", () => {
    const layout = { ...layoutWith(frame("a", 100)), fixtures: [frame("a", 100), fixture({ id: "t", x: 300 })] };
    expect(apply(layout, { type: "linkRun", ids: ["a", "t"] }, newId)).toBe(layout);
  });
});

describe("validation", () => {
  it("accepts a run, lets its racks touch, and refuses a run of one", () => {
    const layout = apply(layoutWith(frame("a", 100)), { type: "addRackToRun", rackId: "a", side: "right" }, newId);
    expect(validate(layout)).toEqual([]);
    const broken: Layout = { ...layout, fixtures: layout.fixtures.map((f, i) => (i === 1 ? { ...f, runId: null, runIndex: null } : f)) };
    expect(validate(broken).map((i) => i.kind)).toContain("run");
  });

  it("refuses a frame rack face with more than one row", () => {
    const layout: Layout = { ...layoutWith(frame("a", 100)), faces: [{ ...rail("a"), rows: 2 }] };
    expect(validate(layout).map((i) => i.message)).toContain("a has one rail, so one row.");
  });
});
