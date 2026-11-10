// Where a new item goes at a run's open end: joined straight (frame racks
// spec §4.3 "Add rack to the left/right") or back to back (run joins spec §1.2).

import { normalizeAngle, rotate } from "./frames";
import { endsOf, localEnds, placeLeftEnd, plus, type RunRack } from "./runs";

/** Where a new straight item of `width` goes at a run's open end (spec §4.3 "Add rack to the left/right"). */
export function poseAtEnd(end: RunRack, side: "left" | "right", width: number): { x: number; y: number; rotation: number } {
  const next: RunRack = { ...end, width, curve: 0, id: "", runIndex: 0 };
  if (side === "right") {
    const e = endsOf(end).right;
    const { x, y, rotation } = placeLeftEnd(next, e.at, e.dir);
    return { x, y, rotation };
  }
  // On the left the new item's right end meets this one's left end.
  const e = endsOf(end).left;
  const rotation = normalizeAngle(e.dir);
  const offset = rotate(localEnds(next).right.at, rotation);
  return { x: Math.round(e.at.x - offset.x), y: Math.round(e.at.y - offset.y), rotation };
}

/** Where a new frame rack goes back to back at a run's open end (run joins spec §1.2 "Add rack behind"). */
export function poseBehind(end: RunRack, side: "left" | "right", width: number, depth: number): { x: number; y: number; rotation: number } {
  const e = endsOf(end)[side];
  // Turned around: its joining end sits straight behind this one's, by both half depths.
  const at = plus(e.at, rotate({ x: 0, y: -((end.depth ?? 0) + depth) / 2 }, e.dir));
  const rotation = normalizeAngle(end.rotation + 180);
  const local = side === "right" ? -width / 2 : width / 2;
  const offset = rotate({ x: local, y: 0 }, rotation);
  return { x: Math.round(at.x - offset.x), y: Math.round(at.y - offset.y), rotation };
}
