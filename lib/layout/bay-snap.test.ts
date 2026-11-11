import { describe, expect, it } from "vitest";

import { anchorOf, bendAbout, snapBayEnds } from "./bay-snap";
import { fixturesOverlap } from "./curves";
import { endsOf } from "./runs";
import { fixture, store } from "./test-layouts";
import type { Fixture, Layout } from "./types";

const bay = (id: string, over: Partial<Fixture> = {}) => fixture({ id, type: "wall_bay", name: id, width: 48, depth: 24, rotation: 0, ...over });
const ends = (f: Fixture) => endsOf({ ...f, type: "wall_bay" });
const gap = (p: { x: number; y: number }, q: { x: number; y: number }) => Math.hypot(p.x - q.x, p.y - q.y);
const angle = (a: number, b: number) => Math.abs(((((a - b) % 360) + 540) % 360) - 180);

// Bay a along the top wall: its back-right end at (124, 0), heading right.
const a = bay("a", { x: 100, y: 12 });
const layoutOf = (...fixtures: Fixture[]): Layout => ({ ...store(), fixtures });

/** Where a drag of `f` by `delta` leaves it. */
function dropped(layout: Layout, f: Fixture, delta: { x: number; y: number }, scale = 1) {
  const snap = snapBayEnds(layout, new Set([f.id]), delta, scale);
  if (!snap) return null;
  return { ...f, x: f.x + snap.delta.x, y: f.y + snap.delta.y, rotation: snap.turned?.rotation ?? f.rotation, meets: snap.meets };
}

describe("snapBayEnds (DECISIONS 11-11)", () => {
  it("lands a dragged bay's end on a straight neighbour's end, touching and not overlapping", () => {
    const f = bay("f", { x: 300, y: 100 });
    // Dropped 7 in right of and 5 in below where it would join.
    const placed = dropped(layoutOf(a, f), f, { x: 148 + 7 - 300, y: 12 + 5 - 100 });
    expect(placed).toMatchObject({ x: 148, y: 12, rotation: 0, meets: "a" });
    expect(fixturesOverlap(placed!, a)).toBe(false);
  });

  it("turns a bay to carry straight on from a curved neighbour's end", () => {
    const curved = bay("c", { x: 200, y: 100, width: 96, curve: -14 });
    const end = ends(curved).right;
    expect(angle(end.dir, 0)).toBeGreaterThan(20); // the end really runs off at an angle
    const f = bay("f", { x: 0, y: 0 });
    // Put f's left end 6 in from the curved bay's right end, still square to the walls.
    const left = ends(f).left.at;
    const placed = dropped(layoutOf(curved, f), f, { x: end.at.x + 6 - left.x, y: end.at.y - left.y });
    if (!placed) throw new Error("no snap");
    expect(angle(ends(placed).left.dir, end.dir)).toBeLessThanOrEqual(0.5);
    expect(gap(ends(placed).left.at, end.at)).toBeLessThanOrEqual(3);
    expect(fixturesOverlap(placed, curved)).toBe(false);
  });

  it("keeps a bay square at a corner instead of turning it straight", () => {
    const f = bay("f", { x: 300, y: 200, rotation: 90 });
    // An inside corner: f starts at a's front edge (runs.ts jointOf), heading down.
    const left = ends(f).left.at;
    const placed = dropped(layoutOf(a, f), f, { x: 124 + 4 - left.x, y: 24 + 3 - left.y });
    expect(placed).toMatchObject({ rotation: 90, meets: "a" });
    expect(ends(placed!).left.at).toEqual({ x: 124, y: 24 });
  });

  it("reaches farther when zoomed out, and not at all for a far bay or anything but a wall bay", () => {
    const f = bay("f", { x: 300, y: 100 });
    const near = { x: 148 + 30 - 300, y: 12 - 100 };
    expect(dropped(layoutOf(a, f), f, near, 1)).toBeNull();
    expect(dropped(layoutOf(a, f), f, near, 0.5)).toMatchObject({ x: 148, y: 12 });
    const table = { ...f, type: "table" as const };
    expect(snapBayEnds(layoutOf(a, table), new Set(["f"]), { x: 148 + 7 - 300, y: 12 - 100 }, 1)).toBeNull();
  });

  it("leaves a bay facing the other way alone", () => {
    const f = bay("f", { x: 300, y: 100, rotation: 180 });
    const left = ends(f).left.at;
    expect(dropped(layoutOf(a, f), f, { x: 124 + 5 - left.x, y: 0 - left.y })).toBeNull();
  });
});

describe("anchorOf and bendAbout (DECISIONS 11-11)", () => {
  const f = bay("f", { x: 172, y: 12, width: 96 }); // its left end on a's right end

  it("finds the one end that sits on a neighbour, and none for a bay on its own or in a run", () => {
    expect(anchorOf(layoutOf(a, f), f)).toMatchObject({ end: "left", at: { x: 124, y: 0 }, dir: 0 });
    expect(anchorOf(layoutOf(a, { ...f, x: 400 }), { ...f, x: 400 })).toBeNull();
    const linked = { ...f, runId: "run", runIndex: 1 };
    expect(anchorOf(layoutOf({ ...a, runId: "run", runIndex: 0 }, linked), linked)).toBeNull();
  });

  it("bends about the anchored end: it stays put and in line, and the other end swings", () => {
    const anchor = anchorOf(layoutOf(a, f), f)!;
    const bent = { ...f, ...bendAbout(f, anchor, -20) };
    expect(gap(ends(bent).left.at, { x: 124, y: 0 })).toBeLessThanOrEqual(2);
    expect(angle(ends(bent).left.dir, 0)).toBeLessThanOrEqual(0.5);
    // A curve toward the back, held at the left: the free end swings forward, into the room.
    expect(ends(bent).right.at.y).toBeGreaterThan(20);
    expect(fixturesOverlap(bent, a)).toBe(false);
  });

  it("bends about its middle when both ends are held", () => {
    const b = bay("b", { x: 244, y: 12 });
    expect(anchorOf(layoutOf(a, f, b), f)).toBeNull();
  });
});
