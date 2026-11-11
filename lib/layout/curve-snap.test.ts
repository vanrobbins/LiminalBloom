import { describe, expect, it } from "vitest";

import { bendWithHandle, cornerFit, meetingCurves, snapBend } from "./curve-snap";
import { endsOf, placeLeftEnd } from "./runs";
import { fixture, store } from "./test-layouts";
import type { Fixture, Layout } from "./types";

const bay = (id: string, over: Partial<Fixture> = {}) => fixture({ id, type: "wall_bay", name: id, width: 48, depth: 24, rotation: 0, ...over });
const ends = (f: Fixture) => endsOf({ ...f, type: "wall_bay" });

// An inside corner at (200, 0): bay a along the top, its back-right end at (124, 0) heading right;
// bay b down the side, facing left, its back-left end at (200, 100) heading down.
const a = bay("a", { x: 100, y: 12 });
const b = bay("b", { x: 188, y: 124, rotation: 90 });
const corner = (f: Fixture): Layout => ({ ...store(), fixtures: [a, b, f] });

describe("cornerFit (run joins spec §3.2)", () => {
  it("bends a bay across the corner into a quarter circle that carries straight on from the nearer bay", () => {
    const fit = cornerFit(corner(bay("f", { x: 170, y: 30, width: 96 })), "f");
    if (!fit || "refusal" in fit) throw new Error("no fit");
    expect(fit.changes.width % 6).toBe(0);
    expect(fit.changes.curve).toBeLessThan(0); // the middle bends back into the corner
    const placed = ends({ ...bay("f"), ...fit.changes });
    expect(Math.hypot(placed.left.at.x - 124, placed.left.at.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(placed.left.dir)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(placed.right.dir - 90)).toBeLessThanOrEqual(0.5);
    // b starts further from the corner than a ends, so the far side stops short of it: never past it.
    expect(fit.gap).toBeGreaterThan(0);
    expect(placed.right.at.y).toBeLessThan(100);
    expect(fit.meets).toEqual(["a", "b"]);
  });

  it("refuses a corner too tight for the bay's depth", () => {
    const tightA = bay("a", { x: 176, y: 12 }); // ends 0 in from the corner
    const fit = cornerFit({ ...store(), fixtures: [tightA, b, bay("f", { x: 190, y: 20, width: 96 })] }, "f");
    expect(fit).toMatchObject({ refusal: expect.stringContaining("Too tight") });
  });

  it("offers nothing for a bay nowhere near a corner, or for anything but a wall bay", () => {
    expect(cornerFit(corner(bay("f", { x: 400, y: 300 })), "f")).toBeNull();
    expect(cornerFit(corner({ ...bay("f", { x: 170, y: 30 }), type: "table" }), "f")).toBeNull();
  });
});

describe("meetingCurves and snapBend (run joins spec §3.1)", () => {
  // A straight bay turned 10° off a's line, its back-left end just past a's back-right end.
  const f = placeLeftEnd({ ...bay("f", { width: 96 }), runIndex: 0 }, { x: 126, y: 2 }, 10);
  const layout = corner(f);

  it("finds the curve that makes its end carry straight on from a's", () => {
    const meeting = meetingCurves(layout, f).find((m) => m.meets === "a");
    if (!meeting) throw new Error("no meeting");
    const bent = ends({ ...f, curve: meeting.curve });
    expect(Math.abs(bent.left.dir)).toBeLessThanOrEqual(0.5);
    expect(Math.hypot(bent.left.at.x - 124, bent.left.at.y)).toBeLessThanOrEqual(12);
  });

  it("pulls the handle onto it within 3 in (zoomed in), lands the end on a's, and says which bay it meets; not with snapping off", () => {
    const target = meetingCurves(layout, f).find((m) => m.meets === "a")!.curve;
    const snapped = snapBend(layout, f, target + 2, true, 4);
    expect(snapped).toMatchObject({ changes: { curve: target }, meets: "a" });
    const landed = ends({ ...f, ...snapped.changes });
    expect(Math.hypot(landed.left.at.x - 124, landed.left.at.y)).toBeLessThanOrEqual(3);
    expect(snapBend(layout, f, target + 5, true, 4)).toEqual({ changes: { curve: target + 5 }, meets: null });
    expect(snapBend(layout, f, target + 2, false)).toEqual({ changes: { curve: target + 2 }, meets: null });
  });

  it("reaches farther when zoomed out: 12 px on screen", () => {
    const target = meetingCurves(layout, f).find((m) => m.meets === "a")!.curve;
    expect(snapBend(layout, f, target + 5, true, 0.5)).toMatchObject({ changes: { curve: target }, meets: "a" });
  });
});

describe("bending a bay joined to a neighbour (DECISIONS 11-11)", () => {
  // g sits on a's right end; b waits down the side wall for g to curve round to it.
  const g = bay("g", { x: 172, y: 12, width: 96 });
  const joined: Layout = { ...store(), fixtures: [a, b, g] };

  it("keeps the joined end in place whatever the curve, and outlines the bay it stays on", () => {
    const { changes, meets } = snapBend(joined, g, -9, false);
    expect(meets).toBe("a");
    const bent = ends({ ...g, ...changes });
    expect(Math.hypot(bent.left.at.x - 124, bent.left.at.y)).toBeLessThanOrEqual(2);
    expect(Math.abs(bent.left.dir)).toBeLessThanOrEqual(0.5);
  });

  it("the handle swings the bay toward the pointer: dragged forward, the free end comes forward", () => {
    const { changes } = bendWithHandle(joined, g, { x: 172, y: 24 }, { x: 172, y: 44 }, false, 1);
    expect(changes.curve).toBe(-20);
    expect(ends({ ...g, ...changes }).right.at.y).toBeGreaterThan(20);
  });

  it("snaps to the curve that turns its free end to run into the bay round the corner", () => {
    const quarter = meetingCurves({ ...joined, fixtures: [a, { ...b, y: 97 }, g] }, g).find((m) => m.meets === "b");
    if (!quarter) throw new Error("no meeting");
    expect(Math.abs(ends({ ...g, ...quarter.changes }).right.dir - 90)).toBeLessThanOrEqual(1);
  });
});
