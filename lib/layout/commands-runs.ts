// Building frame rack runs on the map (frame racks spec §4.3): add a rack at
// an open end, link racks into a run, take a rack out, and choose where a
// closed run's combined grid starts reading. Like every command these never
// validate; normalize() snaps the racks into place and closes up indexes.

import { nextName, type NewId } from "./factories";
import { autoGrid } from "./fixture-grids";
import { FIXTURE_RULES } from "./fixtures";
import { rotate } from "./frames";
import { poseAtEnd, poseBehind } from "./run-poses";
import { MAX_RUN_RACKS, byIndex, isRunType, linkPoint, rackEnds, runShape, runWord, type RunRack } from "./runs";
import type { Face, Fixture, Layout } from "./types";

const asRack = (f: Fixture): RunRack => ({ ...f, runIndex: f.runIndex ?? 0 });

export function runRacks(layout: Layout, runId: string): Fixture[] {
  return byIndex(layout.fixtures.filter((f) => f.runId === runId).map((f) => ({ ...f, runIndex: f.runIndex ?? 0 })));
}

/** Which ends of a rack are open for another rack: both for a rack on its own, the run's ends otherwise, none when closed or full. */
export function openEnds(layout: Layout, rackId: string): { left: boolean; right: boolean } {
  const rack = layout.fixtures.find((f) => f.id === rackId);
  if (!rack || !isRunType(rack.type)) return { left: false, right: false };
  if (rack.runId === null) return { left: true, right: true };
  const racks = runRacks(layout, rack.runId);
  if (racks.length >= MAX_RUN_RACKS || runShape(racks.map(asRack)).closed) return { left: false, right: false };
  return { left: rack.runIndex === 0, right: rack.runIndex === racks.length - 1 };
}

/**
 * A new 48 in frame rack at one open end (spec §4.3): joined straight, or
 * `behind` it, back to back (run joins spec §1.2). A corner comes from
 * rotating it afterwards.
 */
export function addRackToRun(layout: Layout, rackId: string, side: "left" | "right", newId: NewId, behind = false): Layout {
  const rack = layout.fixtures.find((f) => f.id === rackId);
  if (!rack || !openEnds(layout, rackId)[side]) return layout;
  // Only racks go back to back: a bay's back is against the wall.
  if (behind && rack.type !== "frame_rack") return layout;
  const rule = FIXTURE_RULES[rack.type];
  const pose = behind ? poseBehind(asRack(rack), side, rule.width, rule.depth) : poseAtEnd(asRack(rack), side, rule.width);
  const runId = rack.runId ?? newId();
  const members = rack.runId ? runRacks(layout, rack.runId) : [{ ...rack, runIndex: 0 }];
  // Left of the anchor, the new rack becomes index 0; the save moves the planogram to it.
  const shift = side === "left" ? 1 : 0;
  const reindexed = new Map(members.map((f) => [f.id, (f.runIndex ?? 0) + shift]));
  const id = newId();
  const added: Fixture = {
    id,
    zoneId: rack.zoneId,
    type: rack.type,
    name: nextName(layout.fixtures.map((f) => f.name), rule.label),
    ...pose,
    curve: 0,
    width: rule.width,
    depth: rule.depth,
    tableSetId: null,
    setSide: null,
    runId,
    runIndex: side === "left" ? 0 : members.length,
    version: 0,
  };
  const face: Face = { id: newId(), fixtureId: id, side: "front", ...autoGrid(added, "front"), version: 0 };
  return {
    ...layout,
    frameRuns: rack.runId ? layout.frameRuns : [...layout.frameRuns, { id: runId, startIndex: 0, version: 0 }],
    fixtures: [...layout.fixtures.map((f) => (reindexed.has(f.id) ? { ...f, runId, runIndex: reindexed.get(f.id)! } : f)), added],
    faces: [...layout.faces, face],
  };
}

/** Why a rack can't leave its run, or null when it can (spec §4.3). */
export function removalRefusal(layout: Layout, rackId: string): string | null {
  const rack = layout.fixtures.find((f) => f.id === rackId);
  if (!rack || rack.runId === null) return null;
  const racks = runRacks(layout, rack.runId);
  if (runShape(racks.map(asRack)).closed) return null;
  const atEnd = rack.runIndex === 0 || rack.runIndex === racks.length - 1;
  return atEnd ? null : `Remove an end ${runWord(rack.type)} first.`;
}

/**
 * Takes a rack out of its run: an end of an open run, or any rack of a closed
 * one, which opens there. It steps 12 in forward so it no longer touches.
 * A run left with one rack is dissolved by normalize().
 */
export function removeFromRun(layout: Layout, rackId: string): Layout {
  const rack = layout.fixtures.find((f) => f.id === rackId);
  if (!rack || rack.runId === null || removalRefusal(layout, rackId)) return layout;
  const racks = runRacks(layout, rack.runId);
  const closed = runShape(racks.map(asRack)).closed;
  const at = racks.findIndex((f) => f.id === rackId);
  // A closed run opens at the rack: the chain now starts just after it.
  const rest = closed ? [...racks.slice(at + 1), ...racks.slice(0, at)] : racks.filter((f) => f.id !== rackId);
  const index = new Map(rest.map((f, i) => [f.id, i]));
  const step = rotate({ x: 0, y: 12 }, rack.rotation);
  return {
    ...layout,
    frameRuns: layout.frameRuns.map((r) => (r.id === rack.runId ? { ...r, startIndex: 0 } : r)),
    fixtures: layout.fixtures.map((f) => {
      if (f.id === rackId) return { ...f, runId: null, runIndex: null, x: Math.round(f.x + step.x), y: Math.round(f.y + step.y) };
      return index.has(f.id) ? { ...f, runIndex: index.get(f.id)! } : f;
    }),
  };
}

/**
 * The order selected racks already make on the floor, end to end, or null
 * when they don't form one chain.
 */
export function chainOrder(racks: readonly Fixture[]): string[] | null {
  const ends = racks.map((f) => ({ id: f.id, ...rackEnds(asRack(f)) }));
  const near = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.abs(a.x - b.x) <= 1 && Math.abs(a.y - b.y) <= 1;
  const next = (id: string) => {
    const e = ends.find((x) => x.id === id)!;
    return ends.find((o) => o.id !== id && near(e.right, o.left))?.id;
  };
  const starts = ends.filter((e) => !ends.some((o) => o.id !== e.id && near(o.right, e.left)));
  // A closed loop has no start: begin anywhere.
  let at: string | undefined = (starts[0] ?? ends[0])?.id;
  const order: string[] = [];
  while (at && !order.includes(at)) {
    order.push(at);
    at = next(at);
  }
  return order.length === racks.length ? order : null;
}

/**
 * Links 2–6 frame racks that are in no run yet (spec §4.3). They keep the
 * chain they make on the floor; if they don't touch end to end they go in
 * selected order, and normalize() snaps them into a straight line. `anchorId`
 * (the rack with a planogram, when one has) becomes index 0.
 */
export function linkRun(layout: Layout, ids: readonly string[], newId: NewId, anchorId?: string): Layout {
  const racks = ids.map((id) => layout.fixtures.find((f) => f.id === id)).filter((f): f is Fixture => f !== undefined);
  if (racks.length < 2 || racks.length > MAX_RUN_RACKS || racks.some((f) => !isRunType(f.type) || f.type !== racks[0].type || f.runId !== null)) return layout;
  let order = chainOrder(racks) ?? racks.map((f) => f.id);
  if (anchorId && order.includes(anchorId) && order[0] !== anchorId) {
    const at = order.indexOf(anchorId);
    // Only a closed loop can start anywhere; otherwise the floor order wins over the anchor.
    if (chainOrder(racks) && runShape(racks.map((f) => ({ ...asRack(f), runIndex: order.indexOf(f.id) }))).closed) {
      order = [...order.slice(at), ...order.slice(0, at)];
    }
  }
  const runId = newId();
  const index = new Map(order.map((id, i) => [id, i]));
  return {
    ...layout,
    frameRuns: [...layout.frameRuns, { id: runId, startIndex: 0, version: 0 }],
    fixtures: layout.fixtures.map((f) => (index.has(f.id) ? { ...f, runId, runIndex: index.get(f.id)! } : f)),
  };
}

/** Closed runs only: where the combined grid starts reading (spec §4.3). */
export function setRunStart(layout: Layout, runId: string, startIndex: number): Layout {
  return { ...layout, frameRuns: layout.frameRuns.map((r) => (r.id === runId ? { ...r, startIndex: Math.round(startIndex) } : r)) };
}

/** Every rack of the runs a selection touches: what the map outlines (spec §4.3). */
export function selectedRunRacks(layout: Layout, selection: readonly string[]): Fixture[] {
  const runs = new Set(layout.fixtures.filter((f) => f.runId !== null && selection.includes(f.id)).map((f) => f.runId));
  return layout.fixtures.filter((f) => f.runId !== null && runs.has(f.runId));
}

/**
 * Joins a rack's chain onto `targetId`'s open end (the Link button, spec §4.3).
 * The rack's chain moves to meet it; the target's stays put. The left chain's
 * anchor leads the merged run, and normalize() drops the run left empty.
 */
export function joinRun(layout: Layout, rackId: string, targetId: string, side: "left" | "right", newId: NewId): Layout {
  const rack = layout.fixtures.find((f) => f.id === rackId);
  const target = layout.fixtures.find((f) => f.id === targetId);
  if (!rack || !target || !isRunType(rack.type) || rack.type !== target.type || !openEnds(layout, targetId)[side]) return layout;
  if (rack.runId !== null && rack.runId === target.runId) return layout;
  const chainOf = (f: Fixture) => (f.runId ? runRacks(layout, f.runId) : [f]);
  const moving = chainOf(rack);
  const staying = chainOf(target);
  const [first, second] = side === "right" ? [staying, moving] : [moving, staying];
  if (first.length + second.length > MAX_RUN_RACKS) return layout;

  const from = rackEnds(asRack(rack))[side === "right" ? "left" : "right"];
  const to = linkPoint(asRack(rack), asRack(target), side);
  if (!to) return layout;
  const dx = Math.round(to.x - from.x);
  const dy = Math.round(to.y - from.y);
  const movingIds = new Set(moving.map((f) => f.id));
  const index = new Map([...first, ...second].map((f, i) => [f.id, i]));
  const runId = first[0].runId ?? second[0].runId ?? newId();
  const known = layout.frameRuns.some((r) => r.id === runId);
  return {
    ...layout,
    frameRuns: known ? layout.frameRuns : [...layout.frameRuns, { id: runId, startIndex: 0, version: 0 }],
    fixtures: layout.fixtures.map((f) => {
      if (!index.has(f.id)) return f;
      const placed = movingIds.has(f.id) ? { ...f, x: f.x + dx, y: f.y + dy } : f;
      return { ...placed, runId, runIndex: index.get(f.id)! };
    }),
  };
}
