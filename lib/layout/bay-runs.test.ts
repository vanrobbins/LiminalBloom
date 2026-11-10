// Wall bay runs (run joins spec §2): bays joined back corner to back corner,
// straight or at a corner, curved or not, one type per run.

import { describe, expect, it } from "vitest";

import { apply } from "./commands";
import { findJoin } from "./run-join";
import { endsOf, runShape, snapRun, type RunRack } from "./runs";
import { face, fixture, store } from "./test-layouts";
import type { Fixture, Layout } from "./types";
import { validate } from "./validate";

let n = 0;
const newId = () => `id-${++n}`;

const bay = (id: string, over: Partial<Fixture> = {}) =>
  fixture({ id, type: "wall_bay", name: id, x: 100, y: 100, width: 48, depth: 24, rotation: 0, ...over });
const item = (f: Fixture, runIndex: number): RunRack => ({ ...f, runIndex });

function layoutWith(...bays: Fixture[]): Layout {
  const runs = [...new Set(bays.map((b) => b.runId).filter((id) => id !== null))];
  return {
    ...store(),
    fixtures: bays,
    faces: bays.map((b) => face({ id: `${b.id}-front`, fixtureId: b.id, side: "front", columns: 8, rows: 3 })),
    frameRuns: runs.map((id) => ({ id, startIndex: 0, version: 1 })),
  };
}

describe("bay joins", () => {
  it("joins straight along the wall, back corner to back corner", () => {
    expect(runShape([item(bay("a"), 0), item(bay("b", { x: 148 }), 1)]).joins).toEqual(["straight"]);
  });

  it("turns an inside corner from the first bay's front edge, so they touch without overlapping", () => {
    // a's back-right corner is (124, 88); b turns toward a's front and starts 24 in further on.
    const b = bay("b", { x: 112, y: 136, rotation: 90 });
    expect(endsOf({ ...b }).left.at).toEqual({ x: 124, y: 112 });
    expect(runShape([item(bay("a"), 0), item(b, 1)]).joins).toEqual(["corner"]);
    const layout = layoutWith({ ...bay("a"), runId: "r", runIndex: 0 }, { ...b, runId: "r", runIndex: 1 });
    expect(validate(layout)).toEqual([]);
  });

  it("follows a curved bay: the next one carries on along its end", () => {
    const curved = bay("a", { width: 96, curve: 20 });
    // Roughly along a's right end (about −51°), so it snaps straight on, not to a corner.
    const [next] = snapRun([item(curved, 0), item(bay("b", { x: 200, y: 100, rotation: 305 }), 1)]);
    expect(next.rotation).toBe(Math.round(endsOf(curved).right.dir + 360) % 360);
    expect(runShape([item(curved, 0), next]).joined).toBe(true);
  });

  it("never turns a bay around: its back is against the wall", () => {
    const shape = runShape([item(bay("a"), 0), item(bay("b", { x: 100, y: 76, rotation: 180 }), 1)]);
    expect(shape.joined).toBe(false);
  });
});

describe("bay run commands", () => {
  it("adds a wall bay at an open end, and never one behind", () => {
    const next = apply(layoutWith(bay("a")), { type: "addRackToRun", rackId: "a", side: "right" }, newId);
    const added = next.fixtures.find((f) => f.id !== "a")!;
    expect(added).toMatchObject({ type: "wall_bay", x: 148, y: 100, rotation: 0, runIndex: 1 });
    expect(validate(next)).toEqual([]);
    const behind = apply(layoutWith(bay("a")), { type: "addRackToRun", rackId: "a", side: "right", behind: true }, newId);
    expect(behind.fixtures).toHaveLength(1);
  });

  it("links bays, but never bays with racks", () => {
    const linked = apply(layoutWith(bay("a"), bay("b", { x: 148 })), { type: "linkRun", ids: ["a", "b"] }, newId);
    expect(linked.fixtures.every((f) => f.runId !== null)).toBe(true);
    const mixed = layoutWith(bay("a"), { ...bay("b", { x: 148 }), type: "frame_rack" });
    expect(apply(mixed, { type: "linkRun", ids: ["a", "b"] }, newId)).toBe(mixed);
  });

  it("offers a join to a bay dragged near another bay's end, and not to a rack", () => {
    expect(findJoin(layoutWith(bay("a"), bay("b", { x: 155 })), new Set(["b"]))).toMatchObject({ targetId: "a", side: "right" });
    const rack = { ...bay("b", { x: 155 }), type: "frame_rack" as const };
    expect(findJoin(layoutWith(bay("a"), rack), new Set(["b"]))).toBeNull();
  });

  it("refuses a run that mixes racks and bays", () => {
    const layout = layoutWith({ ...bay("a"), runId: "r", runIndex: 0 }, { ...bay("b", { x: 148 }), type: "frame_rack", runId: "r", runIndex: 1 });
    expect(validate(layout).map((i) => i.message)).toContain("A run is all frame racks or all wall bays.");
  });
});
