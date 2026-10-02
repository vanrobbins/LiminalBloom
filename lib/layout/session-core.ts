// The editor's state, and the one gate every change passes (spec §6–7).
// Pure: React only stores the result (components/store-map/use-map-editor.ts).

import { scaleLimits, type Camera, type ScaleLimits, type Viewport } from "./camera";
import { apply, pointsOf, type Command, type VertexOwner } from "./commands";
import { changedIds } from "./entities";
import type { NewId } from "./factories";
import { bounds, type Bounds } from "./geometry";
import { EMPTY_HISTORY, record, type History } from "./history";
import { OVERVIEW, type Focus, type HitTarget } from "./hit-test";
import type { Drawing } from "./outline-draw";
import type { Guide } from "./snap";
import { OUTLINE_ID, type FixtureType, type Issue, type Layout, type Point } from "./types";
import { newIssues, validate } from "./validate";

export type VertexRef = { owner: VertexOwner; index: number };
export type Preview = { layout: Layout; issues: Issue[]; guides: Guide[] };
export type Drag = { target: HitTarget; start: Layout; origin: Point; ids: string[] };
export type Marquee = { from: Point; to: Point };
export type AddKind = "zone" | "entrance" | FixtureType;

export type Session = {
  layout: Layout;
  history: History;
  selection: string[];
  vertex: VertexRef | null;
  focus: Focus;
  camera: Camera;
  viewport: Viewport;
  drag: Drag | null;
  preview: Preview | null;
  marquee: Marquee | null;
  drawing: Drawing | null;
  pointer: Point | null;
  snapping: boolean;
  readOnly: boolean;
  notice: string | null;
};

/** A 40 ft square, for a store with no outline yet. */
const NO_OUTLINE_AREA: Bounds = { minX: 0, minY: 0, maxX: 480, maxY: 480 };

export function createSession(layout: Layout, readOnly: boolean): Session {
  return {
    layout,
    history: EMPTY_HISTORY,
    selection: [],
    vertex: null,
    focus: OVERVIEW,
    camera: { x: 0, y: 0, scale: 0.1 },
    viewport: { width: 0, height: 0 },
    drag: null,
    preview: null,
    marquee: null,
    drawing: null,
    pointer: null,
    snapping: true,
    readOnly,
    notice: null,
  };
}

export function storeBounds(layout: Layout): Bounds {
  const points = layout.outline?.points ?? [];
  return points.length > 0 ? bounds(points) : NO_OUTLINE_AREA;
}

export function limitsFor(session: Session): ScaleLimits {
  return scaleLimits(storeBounds(session.layout), session.viewport);
}

export function exists(layout: Layout, id: string): boolean {
  if (id === OUTLINE_ID) return layout.outline !== null;
  return (
    layout.zones.some((z) => z.id === id) ||
    layout.fixtures.some((f) => f.id === id) ||
    layout.entrances.some((e) => e.id === id)
  );
}

export function stillThere(layout: Layout, vertex: VertexRef | null): VertexRef | null {
  if (!vertex) return null;
  const points = pointsOf(layout, vertex.owner);
  return points && vertex.index < points.length ? vertex : null;
}

/**
 * Keep `next` only if it gives what it changed no new problem; otherwise keep
 * `before` and say why. Every overlapping or out-of-bounds placement is
 * blocked this way (§1.5); the server repeats the same check (spec §8).
 */
export function accept(session: Session, before: Layout, next: Layout): Session {
  const changed = changedIds(before, next);
  if (changed.size === 0) return { ...session, layout: before };
  const problems = newIssues(validate(before, changed), validate(next, changed), changed);
  if (problems.length > 0) {
    // Name the problem from the point of view of what was moved.
    const own = problems.find((issue) => changed.has(issue.itemId)) ?? problems[0];
    return { ...session, layout: before, notice: own.message };
  }
  return {
    ...session,
    layout: next,
    history: record(session.history, before, next),
    selection: session.selection.filter((id) => exists(next, id)),
    vertex: stillThere(next, session.vertex),
  };
}

export function commit(session: Session, command: Command, newId: NewId): Session {
  if (session.readOnly) return session;
  return accept(session, session.layout, apply(session.layout, command, newId));
}
