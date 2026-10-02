// Edits that are not drags: adding, nudging, rotating, deleting, duplicating,
// Escape, and setting up the outline (spec §7, §10).

import { fit, viewCentre } from "./camera";
import { pointsOf } from "./commands";
import { findFreeSpot, newEntrance, newFixture, newZone, rectanglePoints, type NewId } from "./factories";
import { corners, mayOverlap, rectsOverlap } from "./fixtures";
import { classify, polygonContains, polygonsOverlap } from "./geometry";
import { OVERVIEW } from "./hit-test";
import { EMPTY_DRAWING, placeCorner, undoCorner } from "./outline-draw";
import { commit, storeBounds, type AddKind, type Session } from "./session-core";
import { duplicateSelection } from "./session-duplicate";
import { focusOn } from "./session-view";
import { OUTLINE_ID, type Point } from "./types";

export type EditAction =
  | { type: "nudge"; dx: number; dy: number }
  | { type: "rotate"; by: number }
  | { type: "delete" }
  | { type: "duplicate" }
  | { type: "add"; kind: AddKind; at?: Point }
  | { type: "escape" }
  | { type: "snapping"; on: boolean }
  | { type: "startDrawing" }
  | { type: "drawPointer"; at: Point | null }
  | { type: "undoCorner" }
  | { type: "cancelDrawing" }
  | { type: "setRectangle"; width: number; depth: number }
  | { type: "noticeShown" };

export const NO_ROOM = "No room here. Zoom out or clear some space.";
const MIN_SEARCH_RADIUS = 120;

export function onEdit(session: Session, action: EditAction, newId: NewId): Session {
  switch (action.type) {
    case "noticeShown":
      return { ...session, notice: null };
    case "escape":
      return escape(session);
    case "snapping":
      return { ...session, snapping: action.on };
  }
  // A drag in progress would overwrite these when it is released.
  if (session.readOnly || session.drag) return session;
  switch (action.type) {
    case "nudge":
      return commit(session, { type: "move", ids: editableSelection(session), delta: { x: action.dx, y: action.dy } }, newId);
    case "rotate":
      return rotate(session, action.by, newId);
    case "delete":
      return remove(session, newId);
    case "duplicate":
      return duplicateSelection(session, newId);
    case "add":
      return add(session, action.kind, action.at, newId);
    case "startDrawing":
      return { ...focusOn(session, OVERVIEW), drawing: EMPTY_DRAWING };
    case "drawPointer":
      return { ...session, pointer: action.at };
    case "undoCorner":
      return session.drawing ? { ...session, drawing: undoCorner(session.drawing) } : session;
    case "cancelDrawing":
      return { ...session, drawing: null, pointer: null };
    case "setRectangle":
      return fitIfChanged(session, commit(session, { type: "setOutline", points: rectanglePoints(action.width, action.depth) }, newId));
  }
}

function editableSelection(session: Session): string[] {
  return session.selection.filter((id) => id !== OUTLINE_ID);
}

/** Refit only when the outline was accepted; a refused one leaves the view alone. */
function fitIfChanged(before: Session, next: Session): Session {
  return next.layout === before.layout ? next : withFittedOutline(next);
}

function withFittedOutline(session: Session): Session {
  return { ...session, camera: fit(storeBounds(session.layout), session.viewport) };
}

/** Esc backs out one step at a time: drag, drawing, corner, selection, focus (spec §7). */
function escape(session: Session): Session {
  if (session.drag) return { ...session, drag: null, preview: null, marquee: null };
  if (session.drawing) return { ...session, drawing: null, pointer: null };
  if (session.vertex) return { ...session, vertex: null };
  if (session.selection.length > 0) return { ...session, selection: [] };
  if (session.focus.kind === "zone") return focusOn(session, OVERVIEW);
  return session;
}

function rotate(session: Session, by: number, newId: NewId): Session {
  const [id] = session.selection;
  const f = session.selection.length === 1 ? session.layout.fixtures.find((x) => x.id === id) : undefined;
  if (!f || f.tableSetId !== null) return session;
  return commit(session, { type: "updateFixture", id: f.id, changes: { rotation: f.rotation + by } }, newId);
}

function remove(session: Session, newId: NewId): Session {
  if (session.vertex) {
    const points = pointsOf(session.layout, session.vertex.owner);
    if (!points || points.length <= 3) return { ...session, notice: "A shape needs at least 3 corners." };
    return commit({ ...session, vertex: null }, { type: "removeVertex", owner: session.vertex.owner, index: session.vertex.index }, newId);
  }
  const ids = editableSelection(session);
  return ids.length === 0 ? session : commit(session, { type: "delete", ids }, newId);
}

/** + Add: the new item appears in view, nudged to the nearest free spot, already selected (spec §7). */
function add(session: Session, kind: AddKind, at: Point | undefined, newId: NewId): Session {
  const { layout } = session;
  if (!layout.outline) return { ...session, notice: "Set up the store outline first." };
  const outline = layout.outline.points;
  const centre = at ?? viewCentre(session.camera, session.viewport);
  const radius = Math.max(MIN_SEARCH_RADIUS, Math.max(session.viewport.width, session.viewport.height) / session.camera.scale / 2);
  const overview = session.focus.kind === "overview";
  const id = newId();

  if (kind === "entrance" || kind === "zone") {
    if (!overview) return { ...session, notice: "Leave this zone to add that." };
    if (kind === "entrance") return selectNew(commit(session, { type: "addEntrance", entrance: newEntrance(id, centre) }, newId), session, id);
    const fits = (p: Point) => {
      const zone = newZone(layout, id, p);
      return polygonContains(outline, zone.points) && !layout.zones.some((z) => polygonsOverlap(z.points, zone.points));
    };
    const spot = findFreeSpot(centre, radius, fits);
    if (!spot) return { ...session, notice: NO_ROOM };
    return selectNew(commit(session, { type: "addZone", zone: newZone(layout, id, spot) }, newId), session, id);
  }

  const focus = session.focus;
  const region = focus.kind === "zone" ? (layout.zones.find((z) => z.id === focus.id)?.points ?? outline) : outline;
  const { fixture, faces } = newFixture(layout, kind, id, centre, newId);
  const fits = (p: Point) => {
    const placed = { ...fixture, x: p.x, y: p.y };
    const shape = corners(placed);
    // At the overview a zone's fixtures can't be picked up, so a new one there stays on the store floor.
    const onFloor = !overview || layout.zones.every((z) => classify(p, z.points) === "outside");
    return (
      onFloor &&
      polygonContains(region, shape) &&
      polygonContains(outline, shape) &&
      !layout.fixtures.some((other) => rectsOverlap(other, placed) && !mayOverlap(other, placed, layout.tableSets))
    );
  };
  const spot = findFreeSpot(centre, radius, fits);
  if (!spot) return { ...session, notice: NO_ROOM };
  return selectNew(commit(session, { type: "addFixture", fixture: { ...fixture, ...spot }, faces }, newId), session, id);
}

function selectNew(next: Session, before: Session, id: string): Session {
  return next.layout === before.layout ? next : { ...next, selection: [id], vertex: null };
}

/** A tap while drawing the outline: place a corner, or close the shape and set it. */
export function placeDrawingCorner(session: Session, world: Point, newId: NewId): Session {
  if (!session.drawing) return session;
  const result = placeCorner(session.drawing, world, session.camera.scale);
  if (!result.closed) return { ...session, drawing: result.drawing };
  const next = commit({ ...session, drawing: null, pointer: null }, { type: "setOutline", points: result.closed }, newId);
  // Refused (it crosses itself, say): keep drawing so it can be fixed.
  if (next.layout === session.layout) return { ...next, drawing: session.drawing, pointer: session.pointer };
  return withFittedOutline(next);
}
