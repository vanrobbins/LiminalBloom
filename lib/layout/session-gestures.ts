// What each gesture does to the session (spec §7). Points arrive in screen
// pixels and are turned into store inches here, through the camera.

import { panBy, screenToWorld, zoomAt } from "./camera";
import { apply, pointsOf } from "./commands";
import { changedIds } from "./entities";
import type { NewId } from "./factories";
import type { GestureEffect } from "./gesture";
import { isEditableFixture, type HandleRef, type HitTarget } from "./hit-test";
import { accept, commit, limitsFor, type Marquee, type Session } from "./session-core";
import { planDrag } from "./session-drag";
import { placeDrawingCorner } from "./session-edits";
import { focusOn } from "./session-view";
import { OUTLINE_ID, type Point } from "./types";
import { newIssues, validate } from "./validate";

export function onGesture(session: Session, effect: GestureEffect<HitTarget>, newId: NewId): Session {
  switch (effect.type) {
    case "tap":
      return onTap(session, effect.target, effect.point, effect.shift, newId);
    case "longPress":
      return session.readOnly ? session : toggle(session, effect.target);
    case "dragStart":
      return startDrag(session, effect.target, effect.origin);
    case "drag":
      return moveDrag(session, effect.point, newId);
    case "dragEnd":
      return endDrag(moveDrag(session, effect.point, newId));
    case "dragCancel":
      return { ...session, drag: null, preview: null, marquee: null };
    case "pan":
      return { ...session, camera: panBy(session.camera, effect.dx, effect.dy) };
    case "pinch": {
      const moved = panBy(session.camera, effect.dx, effect.dy);
      return { ...session, camera: zoomAt(moved, effect.center, effect.factor, limitsFor(session)) };
    }
  }
}

function selectOne(session: Session, id: string): Session {
  return { ...session, selection: [id], vertex: null };
}

/** Shift+click and long-press add to or take from the selection. The outline never joins a group. */
function toggleId(session: Session, id: string): Session {
  const has = session.selection.includes(id);
  const others = session.selection.filter((x) => x !== id && x !== OUTLINE_ID);
  return { ...session, vertex: null, selection: has ? others : [...others, id] };
}

function toggle(session: Session, target: HitTarget): Session {
  return target.kind === "fixture" || target.kind === "zone" || target.kind === "entrance"
    ? toggleId(session, target.id)
    : session;
}

function onTap(session: Session, target: HitTarget, screen: Point, shift: boolean, newId: NewId): Session {
  if (session.drawing) return placeDrawingCorner(session, screenToWorld(session.camera, screen), newId);

  if (session.readOnly) {
    if (target.kind === "zone") return focusOn(session, { kind: "zone", id: target.id });
    if (target.kind === "fixture") return selectOne(session, target.id);
    return { ...session, selection: [] };
  }

  switch (target.kind) {
    case "handle":
      return tapHandle(session, target.ref, newId);
    case "zone": {
      // Tap selects; tapping the selected zone again opens it (spec §7).
      const onlyThis = session.selection.length === 1 && session.selection[0] === target.id;
      if (onlyThis && !shift) return focusOn(session, { kind: "zone", id: target.id });
      return shift ? toggleId(session, target.id) : selectOne(session, target.id);
    }
    case "fixture":
    case "entrance":
      return shift ? toggleId(session, target.id) : selectOne(session, target.id);
    case "outline":
      return selectOne(session, OUTLINE_ID);
    case "empty":
    case "marquee":
      return shift ? session : { ...session, selection: [], vertex: null };
  }
}

function tapHandle(session: Session, ref: HandleRef, newId: NewId): Session {
  if (ref.kind === "vertex") return { ...session, vertex: { owner: ref.owner, index: ref.index } };
  if (ref.kind !== "midpoint") return session;
  const points = pointsOf(session.layout, ref.owner);
  if (!points) return session;
  const a = points[ref.index];
  const b = points[(ref.index + 1) % points.length];
  const at = { x: Math.round((a.x + b.x) / 2), y: Math.round((a.y + b.y) / 2) };
  const next = commit(session, { type: "insertVertex", owner: ref.owner, after: ref.index, at }, newId);
  return next.layout === session.layout ? next : { ...next, vertex: { owner: ref.owner, index: ref.index + 1 } };
}

function startDrag(session: Session, target: HitTarget, originScreen: Point): Session {
  if (session.readOnly) return session;
  const origin = screenToWorld(session.camera, originScreen);
  if (target.kind === "marquee") {
    return { ...session, drag: { target, start: session.layout, origin, ids: [] }, marquee: { from: origin, to: origin } };
  }
  let { selection, vertex } = session;
  if (target.kind === "fixture" || target.kind === "zone" || target.kind === "entrance") {
    // Dragging something unselected selects it first.
    if (!selection.includes(target.id)) selection = [target.id];
    vertex = null;
  }
  if (target.kind === "handle" && target.ref.kind === "vertex") {
    vertex = { owner: target.ref.owner, index: target.ref.index };
  }
  const ids = target.kind === "handle" ? [] : selection.filter((id) => id !== OUTLINE_ID);
  return { ...session, selection, vertex, drag: { target, start: session.layout, origin, ids } };
}

function moveDrag(session: Session, pointerScreen: Point, newId: NewId): Session {
  const drag = session.drag;
  if (!drag) return session;
  const pointer = screenToWorld(session.camera, pointerScreen);
  if (drag.target.kind === "marquee") return { ...session, marquee: { from: drag.origin, to: pointer } };
  const plan = planDrag(session, drag, pointer);
  // The thing being dragged is gone (a rebase removed it): drop the stale preview so release changes nothing.
  if (!plan) return { ...session, preview: null };
  const layout = apply(drag.start, plan.command, newId);
  const changed = changedIds(drag.start, layout);
  const issues = newIssues(validate(drag.start, changed), validate(layout, changed), changed);
  return { ...session, preview: { layout, issues, guides: plan.guides } };
}

function endDrag(session: Session): Session {
  const { drag, preview, marquee } = session;
  if (!drag) return session;
  const cleared: Session = { ...session, drag: null, preview: null, marquee: null };
  if (drag.target.kind === "marquee") return marquee ? selectInBox(cleared, marquee) : cleared;
  return preview ? accept(cleared, drag.start, preview.layout) : cleared;
}

function selectInBox(session: Session, box: Marquee): Session {
  const minX = Math.min(box.from.x, box.to.x);
  const maxX = Math.max(box.from.x, box.to.x);
  const minY = Math.min(box.from.y, box.to.y);
  const maxY = Math.max(box.from.y, box.to.y);
  const inside = (p: Point) => p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY;
  const { layout, focus } = session;
  const overview = focus.kind === "overview";
  const selection = [
    ...layout.fixtures.filter((f) => f.tableSetId === null && isEditableFixture(f, focus) && inside(f)).map((f) => f.id),
    ...(overview ? layout.zones.filter((z) => z.points.every(inside)).map((z) => z.id) : []),
    ...(overview ? layout.entrances.filter(inside).map((e) => e.id) : []),
  ];
  return { ...session, selection, vertex: null };
}
