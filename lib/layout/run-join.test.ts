import { describe, expect, it } from "vitest";

import { apply } from "./commands";
import { runRacks, selectedRunRacks } from "./commands-runs";
import { findJoin } from "./run-join";
import { runShape } from "./runs";
import { face, fixture, store } from "./test-layouts";
import type { Fixture, Layout } from "./types";
import { validate } from "./validate";

let n = 0;
const newId = () => `id-${++n}`;

const frame = (id: string, x: number, over: Partial<Fixture> = {}) =>
  fixture({ id, type: "frame_rack", name: id, x, y: 120, width: 48, depth: 24, rotation: 0, ...over });

function layoutWith(...racks: Fixture[]): Layout {
  const runs = [...new Set(racks.map((r) => r.runId).filter((id) => id !== null))];
  return {
    ...store(),
    fixtures: racks,
    faces: racks.map((r) => face({ id: `${r.id}-rail`, fixtureId: r.id, side: "front", columns: 8, rows: 1 })),
    frameRuns: runs.map((id) => ({ id, startIndex: 0, version: 1 })),
  };
}

const inRun = (runId: string, runIndex: number) => ({ runId, runIndex });
const moving = (...ids: string[]) => new Set(ids);

describe("findJoin", () => {
  it("joins a rack's left end to the right end nearby, and shows where it would sit", () => {
    const join = findJoin(layoutWith(frame("a", 100), frame("b", 155)), moving("b"));
    expect(join).toMatchObject({ rackId: "b", targetId: "a", side: "right", at: { x: 124, y: 120 } });
    expect(join?.outline.map((f) => [f.id, f.x, f.y])).toEqual([["b", 148, 120]]);
  });

  it("joins a rack's right end to the left end nearby", () => {
    expect(findJoin(layoutWith(frame("a", 100), frame("b", 45)), moving("b"))).toMatchObject({ rackId: "b", targetId: "a", side: "left" });
  });

  it("reaches 12 in and no further", () => {
    expect(findJoin(layoutWith(frame("a", 100), frame("b", 160)), moving("b"))).not.toBeNull();
    expect(findJoin(layoutWith(frame("a", 100), frame("b", 161)), moving("b"))).toBeNull();
  });

  it("reaches a corner from a rack's edge, since its end stands half a depth off", () => {
    // Turned 90°: its left end is at (136, 96), 12 in from the edge and 26 in from a's end at (124, 120).
    const turned = frame("b", 136, { y: 120, rotation: 90 });
    expect(findJoin(layoutWith(frame("a", 100), turned), moving("b"))).toBeNull();
    const near = frame("b", 136, { y: 144, rotation: 90 });
    expect(findJoin(layoutWith(frame("a", 100), near), moving("b"))).toMatchObject({ targetId: "a", side: "right" });
  });

  it("refuses any other angle", () => {
    expect(findJoin(layoutWith(frame("a", 100), frame("b", 155, { rotation: 45 })), moving("b"))).toBeNull();
    expect(findJoin(layoutWith(frame("a", 100), frame("b", 155, { rotation: 180 })), moving("b"))).toBeNull();
  });

  it("picks the nearest open end", () => {
    const layout = layoutWith(frame("a", 100), frame("far", 100, { y: 128 }), frame("b", 150, { y: 127 }));
    expect(findJoin(layout, moving("b"))?.targetId).toBe("far");
  });

  it("skips a middle rack: only a run's ends are open", () => {
    const layout = layoutWith(frame("a", 100, inRun("r", 0)), frame("b", 148, inRun("r", 1)), frame("c", 196, inRun("r", 2)), frame("d", 148, { y: 150 }));
    expect(findJoin(layout, moving("d"))).toBeNull();
  });

  it("moves a whole run onto a rack, and keeps the run's own order", () => {
    const layout = layoutWith(frame("a", 100), frame("b", 155, inRun("r", 0)), frame("c", 203, inRun("r", 1)));
    const join = findJoin(layout, moving("b", "c"));
    expect(join).toMatchObject({ rackId: "b", targetId: "a" });
    expect(join?.outline.map((f) => f.x)).toEqual([148, 196]);
  });

  it("offers nothing past six racks", () => {
    const five = ["a", "b", "c", "d", "e"].map((id, i) => frame(id, 100 + i * 48, inRun("r", i)));
    const six = [...five.map((f) => f), frame("f", 340, inRun("r", 5))];
    expect(findJoin(layoutWith(...five, frame("g", 345)), moving("g"))).not.toBeNull();
    expect(findJoin(layoutWith(...six, frame("g", 393)), moving("g"))).toBeNull();
  });

  it("offers nothing for anything but one rack or one run", () => {
    const layout = layoutWith(frame("a", 100), frame("b", 155), frame("c", 300), fixture({ id: "t", x: 300, y: 300 }));
    expect(findJoin(layout, moving("b", "c"))).toBeNull();
    expect(findJoin(layout, moving("t"))).toBeNull();
    expect(findJoin(layout, moving("b", "t"))).toBeNull();
  });
});

describe("back to back (run joins spec §1.2)", () => {
  // a's back is toward −y: a rack turned around and pushed against it sits at y 96.
  it("offers a turned rack near a's back, at either end, and Link puts it there", () => {
    const behindRight = frame("b", 100, { y: 98, rotation: 180 });
    expect(findJoin(layoutWith(frame("a", 100), behindRight), moving("b"))).toMatchObject({ targetId: "a", side: "right" });
    const right = apply(layoutWith(frame("a", 100), behindRight), { type: "joinRun", rackId: "b", targetId: "a", side: "right" }, newId);
    expect(right.fixtures.map((f) => [f.id, f.x, f.y])).toEqual([["a", 100, 120], ["b", 100, 96]]);
    expect(runShape(runRacks(right, right.fixtures[0].runId!).map((f) => ({ ...f, runIndex: f.runIndex ?? 0 }))).joins).toEqual(["back"]);
    expect(validate(right)).toEqual([]);

    // Equal racks back to back meet at both ends; a shorter one reaches only a's left end here.
    const behindLeft = frame("b", 94, { y: 97, rotation: 180, width: 36 });
    expect(findJoin(layoutWith(frame("a", 100), behindLeft), moving("b"))).toMatchObject({ targetId: "a", side: "left" });
    const left = apply(layoutWith(frame("a", 100), behindLeft), { type: "joinRun", rackId: "b", targetId: "a", side: "left" }, newId);
    expect(left.fixtures.map((f) => [f.id, f.y, f.runIndex])).toEqual([["a", 120, 1], ["b", 96, 0]]);
    expect(validate(left)).toEqual([]);
  });

  it("Add rack behind puts a new rack back to back, one run", () => {
    const next = apply(layoutWith(frame("a", 100)), { type: "addRackToRun", rackId: "a", side: "right", behind: true }, newId);
    const added = next.fixtures.find((f) => f.id !== "a")!;
    expect([added.x, added.y, added.rotation]).toEqual([100, 96, 180]);
    expect(validate(next)).toEqual([]);
  });
});

describe("joinRun", () => {
  const shapeOf = (layout: Layout, runId: string) => runShape(runRacks(layout, runId).map((f) => ({ ...f, runIndex: f.runIndex ?? 0 })));

  it("links two lone racks where the still one stands", () => {
    const next = apply(layoutWith(frame("a", 100), frame("b", 155)), { type: "joinRun", rackId: "b", targetId: "a", side: "right" }, newId);
    const [a, b] = next.fixtures;
    expect([a.x, b.x, a.runIndex, b.runIndex]).toEqual([100, 148, 0, 1]);
    expect(next.frameRuns).toHaveLength(1);
    expect(shapeOf(next, a.runId!).joined).toBe(true);
    expect(validate(next)).toEqual([]);
  });

  it("puts a rack dragged to the left in front, without moving the rack it joined", () => {
    const next = apply(layoutWith(frame("a", 100), frame("b", 45)), { type: "joinRun", rackId: "b", targetId: "a", side: "left" }, newId);
    expect(next.fixtures.map((f) => [f.id, f.x, f.runIndex])).toEqual([["a", 100, 1], ["b", 52, 0]]);
  });

  it("makes a corner from a turned rack", () => {
    const next = apply(layoutWith(frame("a", 100), frame("b", 136, { y: 144, rotation: 90 })), { type: "joinRun", rackId: "b", targetId: "a", side: "right" }, newId);
    expect(shapeOf(next, next.fixtures[0].runId!).joins).toEqual(["corner"]);
  });

  it("merges two runs into the left one and drops the other", () => {
    const layout = layoutWith(frame("a", 100, inRun("left", 0)), frame("b", 148, inRun("left", 1)), frame("c", 203, inRun("right", 0)), frame("d", 251, inRun("right", 1)));
    const next = apply(layout, { type: "joinRun", rackId: "c", targetId: "b", side: "right" }, newId);
    expect(next.frameRuns.map((r) => r.id)).toEqual(["left"]);
    expect(next.fixtures.map((f) => [f.id, f.x, f.runId, f.runIndex])).toEqual([
      ["a", 100, "left", 0],
      ["b", 148, "left", 1],
      ["c", 196, "left", 2],
      ["d", 244, "left", 3],
    ]);
  });

  it("does nothing past six racks or at a closed end", () => {
    const six = ["a", "b", "c", "d", "e", "f"].map((id, i) => frame(id, 60 + i * 48, inRun("r", i)));
    const layout = layoutWith(...six, frame("g", 345));
    expect(apply(layout, { type: "joinRun", rackId: "g", targetId: "f", side: "right" }, newId)).toBe(layout);
  });
});

describe("selectedRunRacks", () => {
  const layout = layoutWith(frame("a", 100, inRun("r", 0)), frame("b", 148, inRun("r", 1)), frame("c", 300));

  it("gives every rack of a run when any one of them is selected", () => {
    expect(selectedRunRacks(layout, ["b"]).map((f) => f.id)).toEqual(["a", "b"]);
  });

  it("gives nothing for a rack on its own", () => {
    expect(selectedRunRacks(layout, ["c"])).toEqual([]);
  });
});
