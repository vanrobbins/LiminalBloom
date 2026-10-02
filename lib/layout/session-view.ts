// The camera side of the session: sizing, panning, zooming, and focusing a
// zone (spec §7: one canvas; tapping a zone zooms the camera to it).

import { centreOn, fit, panBy, zoomAt, type Camera, type Viewport } from "./camera";
import { bounds, interiorPoint } from "./geometry";
import { OVERVIEW, sameFocus, type Focus } from "./hit-test";
import { limitsFor, storeBounds, type Session } from "./session-core";
import { OUTLINE_ID, type Point } from "./types";

export type ViewAction =
  | { type: "viewport"; viewport: Viewport }
  | { type: "pan"; dx: number; dy: number }
  | { type: "zoom"; factor: number; at?: Point }
  | { type: "fit" }
  | { type: "focus"; focus: Focus }
  | { type: "reveal"; id: string };

export function fitFocus(session: Session, focus: Focus = session.focus): Camera {
  const zone = focus.kind === "zone" ? session.layout.zones.find((z) => z.id === focus.id) : undefined;
  return fit(zone ? bounds(zone.points) : storeBounds(session.layout), session.viewport);
}

export function focusOn(session: Session, focus: Focus): Session {
  const next = { ...session, focus, selection: [], vertex: null };
  return { ...next, camera: fitFocus(next) };
}

export function onView(session: Session, action: ViewAction): Session {
  switch (action.type) {
    case "viewport": {
      // Until the map has a real size, keep fitting (Review Focus 3).
      const unmeasured = session.viewport.width === 0 || session.viewport.height === 0;
      const next = { ...session, viewport: action.viewport };
      return unmeasured ? { ...next, camera: fitFocus(next) } : next;
    }
    case "pan":
      return { ...session, camera: panBy(session.camera, action.dx, action.dy) };
    case "zoom": {
      const at = action.at ?? { x: session.viewport.width / 2, y: session.viewport.height / 2 };
      return { ...session, camera: zoomAt(session.camera, at, action.factor, limitsFor(session)) };
    }
    case "fit":
      return { ...session, camera: fitFocus(session) };
    case "focus":
      return focusOn(session, action.focus);
    case "reveal":
      return reveal(session, action.id);
  }
}

/** From the list: select an item, open its zone if it has one, and bring it into view. */
function reveal(session: Session, id: string): Session {
  const { layout } = session;
  const zone = layout.zones.find((z) => z.id === id);
  const fixture = layout.fixtures.find((f) => f.id === id);
  const entrance = layout.entrances.find((e) => e.id === id);
  const focus: Focus = fixture?.zoneId ? { kind: "zone", id: fixture.zoneId } : OVERVIEW;
  const target: Point | null = zone ? interiorPoint(zone.points) : (fixture ?? entrance ?? null);
  const focused = sameFocus(focus, session.focus) ? session : focusOn(session, focus);
  const camera = target ? centreOn(focused.camera, focused.viewport, target) : fitFocus(focused);
  return { ...focused, selection: id === OUTLINE_ID || target ? [id] : [], vertex: null, camera };
}
