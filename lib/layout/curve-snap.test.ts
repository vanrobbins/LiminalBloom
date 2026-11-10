import { describe, expect, it } from "vitest";

import { cornerFit, meetingCurves, snapBend } from "./curve-snap";
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

  it("pulls the handle onto it within 3 in, and says which bay it meets; not with snapping off", () => {
    const target = meetingCurves(layout, f).find((m) => m.meets === "a")!.curve;
    expect(snapBend(layout, f, target + 2, true)).toEqual({ curve: target, meets: "a" });
    expect(snapBend(layout, f, target + 5, true)).toEqual({ curve: target + 5, meets: null });
    expect(snapBend(layout, f, target + 2, false)).toEqual({ curve: target + 2, meets: null });
  });
});
