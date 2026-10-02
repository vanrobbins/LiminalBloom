// Duplicate (spec §7): the copy lands beside the original, on the first side
// that has room, so duplicating a large table is not blocked by itself.

import type { NewId } from "./factories";
import { corners } from "./fixtures";
import { bounds } from "./geometry";
import { commit, type Session } from "./session-core";
import { OUTLINE_ID, type Point } from "./types";

const GAP = 12;

/** Right, below, left, then above the selection, each a gap clear of it. */
function offsets(session: Session, ids: readonly string[]): Point[] {
  const wanted = new Set(ids);
  const { layout } = session;
  const points = [
    ...layout.zones.filter((z) => wanted.has(z.id)).flatMap((z) => z.points),
    ...layout.fixtures.filter((f) => wanted.has(f.id)).flatMap((f) => corners(f)),
  ];
  if (points.length === 0) return [{ x: 24, y: 24 }];
  const b = bounds(points);
  const w = b.maxX - b.minX + GAP;
  const h = b.maxY - b.minY + GAP;
  return [
    { x: w, y: 0 },
    { x: 0, y: h },
    { x: -w, y: 0 },
    { x: 0, y: -h },
  ];
}

export function duplicateSelection(session: Session, newId: NewId): Session {
  const ids = session.selection.filter((id) => id !== OUTLINE_ID);
  if (ids.length === 0) return session;
  let blocked: Session | null = null;
  for (const offset of offsets(session, ids)) {
    const made: string[] = [];
    const recording = () => {
      const id = newId();
      made.push(id);
      return id;
    };
    const next = commit(session, { type: "duplicate", ids, offset }, recording);
    if (next.layout === session.layout) {
      blocked ??= next;
      continue;
    }
    // Select the copies of what was selected: new zones and fixtures, not faces, sets or lower tables.
    const copies = made.filter(
      (id) => next.layout.zones.some((z) => z.id === id) || next.layout.fixtures.some((f) => f.id === id && f.tableSetId === null),
    );
    return { ...next, selection: copies, vertex: null };
  }
  return blocked ?? session;
}
