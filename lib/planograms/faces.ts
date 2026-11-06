// Which faces a planogram covers (spec §2): the fixture's own enabled faces in
// the order Front, Back, Left, Right, Top; for a table set, the upper's top and
// each lower table's top. Read from the map, so a side switched off there is
// gone here too.

import { SIDE_LABEL } from "@/lib/layout/format";
import { readingOrder, runShape, turnBetween } from "@/lib/layout/runs";
import { FACE_SIDES, SIDES, type Face, type Fixture, type Layout } from "@/lib/layout/types";

import type { PlanogramFace, PlanogramScope } from "./types";

const bySide = (a: Face, b: Face) => FACE_SIDES.indexOf(a.side) - FACE_SIDES.indexOf(b.side);

/** The fixture whose planogram covers this one: a lower table's upper, a rack's run anchor, else itself. */
export function planogramOwner(layout: Layout, fixtureId: string): Fixture | null {
  const fixture = layout.fixtures.find((f) => f.id === fixtureId);
  if (fixture && fixture.runId !== null) {
    return layout.fixtures.find((f) => f.runId === fixture.runId && f.runIndex === 0) ?? null;
  }
  if (!fixture || fixture.tableSetId === null) return fixture ?? null;
  const set = layout.tableSets.find((s) => s.id === fixture.tableSetId);
  return layout.fixtures.find((f) => f.id === set?.upperFixtureId) ?? null;
}

function toFace(face: Face, owner: Fixture, fixtureName: string, label: string): PlanogramFace {
  return {
    faceId: face.id,
    fixtureId: owner.id,
    fixtureName,
    fixtureType: owner.type,
    side: face.side,
    setSide: owner.setSide,
    label,
    columns: face.columns,
    rows: face.rows,
  };
}

/**
 * A run's planogram covers every rack's rail, in reading order (frame racks
 * spec §6): from the anchor, or from the start index on a closed run.
 */
function runScope(layout: Layout, anchor: Fixture): PlanogramScope {
  const racks = layout.fixtures.filter((f) => f.runId === anchor.runId).map((f) => ({ ...f, runIndex: f.runIndex ?? 0 }));
  const run = layout.frameRuns.find((r) => r.id === anchor.runId);
  const shape = runShape(racks);
  const order = readingOrder(racks, run?.startIndex ?? 0);
  const faces = order.flatMap((id) => {
    const rack = racks.find((f) => f.id === id)!;
    // The join just before this rack; for the anchor of a closed run, the join that closes it.
    const ordered = [...racks].sort((a, b) => a.runIndex - b.runIndex);
    const before = rack.runIndex === 0 ? (shape.closed ? turnBetween(ordered[ordered.length - 1], rack) : null) : shape.joins[rack.runIndex - 1];
    const corner = before === "corner";
    return layout.faces
      .filter((face) => face.fixtureId === id && face.side === "front")
      .map((face) => (corner ? { ...toFace(face, rack, rack.name, `${rack.name} · corner`), corner } : toFace(face, rack, rack.name, rack.name)));
  });
  return { fixtureId: anchor.id, fixtureName: anchor.name, isSet: true, isRun: true, faces };
}

/** Null for a lower table or a rack after a run's anchor (they never have their own planogram), or an unknown id. */
export function planogramScope(layout: Layout, fixtureId: string): PlanogramScope | null {
  const fixture = layout.fixtures.find((f) => f.id === fixtureId && f.tableSetId === null);
  if (!fixture) return null;
  if (fixture.runId !== null) return fixture.runIndex === 0 ? runScope(layout, fixture) : null;
  const facesOf = (id: string) => layout.faces.filter((face) => face.fixtureId === id).sort(bySide);
  const set = layout.tableSets.find((s) => s.upperFixtureId === fixture.id);

  if (!set) {
    const faces = facesOf(fixture.id).map((face) => toFace(face, fixture, fixture.name, SIDE_LABEL[face.side]));
    return { fixtureId: fixture.id, fixtureName: fixture.name, isSet: false, faces };
  }
  const lowers = layout.fixtures
    .filter((f) => f.tableSetId === set.id && f.setSide !== null)
    .sort((a, b) => SIDES.indexOf(a.setSide ?? "front") - SIDES.indexOf(b.setSide ?? "front"));
  const faces = [
    ...facesOf(fixture.id).filter((face) => face.side === "top").map((face) => toFace(face, fixture, fixture.name, "Upper")),
    ...lowers.flatMap((lower) =>
      facesOf(lower.id)
        .filter((face) => face.side === "top")
        .map((face) => toFace(face, lower, lower.name || fixture.name, `${SIDE_LABEL[lower.setSide ?? "front"]} table`)),
    ),
  ];
  return { fixtureId: fixture.id, fixtureName: fixture.name, isSet: true, faces };
}
