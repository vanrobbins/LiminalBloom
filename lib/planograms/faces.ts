// Which faces a planogram covers (spec §2): the fixture's own enabled faces in
// the order Front, Back, Left, Right, Top; for a table set, the upper's top and
// each lower table's top. Read from the map, so a side switched off there is
// gone here too.

import { SIDE_LABEL } from "@/lib/layout/format";
import { FACE_SIDES, SIDES, type Face, type Fixture, type Layout } from "@/lib/layout/types";

import type { PlanogramFace, PlanogramScope } from "./types";

const bySide = (a: Face, b: Face) => FACE_SIDES.indexOf(a.side) - FACE_SIDES.indexOf(b.side);

/** The fixture whose planogram covers this one: a lower table's upper, else itself. */
export function planogramOwner(layout: Layout, fixtureId: string): Fixture | null {
  const fixture = layout.fixtures.find((f) => f.id === fixtureId);
  if (!fixture || fixture.tableSetId === null) return fixture ?? null;
  const set = layout.tableSets.find((s) => s.id === fixture.tableSetId);
  return layout.fixtures.find((f) => f.id === set?.upperFixtureId) ?? null;
}

function toFace(face: Face, owner: Fixture, fixtureName: string, label: string): PlanogramFace {
  return {
    faceId: face.id,
    fixtureId: owner.id,
    fixtureName,
    side: face.side,
    setSide: owner.setSide,
    label,
    columns: face.columns,
    rows: face.rows,
  };
}

/** Null for a lower table (it never has its own planogram) or an unknown id. */
export function planogramScope(layout: Layout, fixtureId: string): PlanogramScope | null {
  const fixture = layout.fixtures.find((f) => f.id === fixtureId && f.tableSetId === null);
  if (!fixture) return null;
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
