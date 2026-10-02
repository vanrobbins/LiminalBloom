// The editor's one reducer (spec §6). The map, the panels, the keyboard and
// the save queue all change the session only by dispatching here.

import type { Command } from "./commands";
import type { NewId } from "./factories";
import type { GestureEffect } from "./gesture";
import { dropTouching, redo, undo } from "./history";
import type { HitTarget } from "./hit-test";
import { conflictNotice, rebase } from "./save-queue";
import { commit, createSession, exists, stillThere, type Session } from "./session-core";
import { onEdit, type EditAction } from "./session-edits";
import { onGesture } from "./session-gestures";
import { fitFocus, onView, type ViewAction } from "./session-view";
import type { Layout } from "./types";

export type SessionAction =
  | { type: "gesture"; effect: GestureEffect<HitTarget> }
  | { type: "command"; command: Command }
  | { type: "select"; ids: string[] }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "rebase"; base: Layout; server: Layout; skip: readonly string[]; sent?: readonly string[]; notice?: string }
  | { type: "replace"; layout: Layout; notice: string }
  | ViewAction
  | EditAction;

const SKIPPED_UNDO = "That change was edited on another device, so it can't be undone.";

export function createReducer(newId: NewId) {
  return function reduce(session: Session, action: SessionAction): Session {
    switch (action.type) {
      case "gesture":
        return onGesture(session, action.effect, newId);
      case "command":
        return commit(session, action.command, newId);
      case "select":
        return { ...session, selection: action.ids.filter((id) => exists(session.layout, id)), vertex: null };
      case "undo":
      case "redo":
        return onHistory(session, action.type);
      case "rebase":
        return onRebase(session, action);
      case "replace": {
        const fresh = { ...createSession(action.layout, session.readOnly), viewport: session.viewport, notice: action.notice };
        // A fresh session is at the overview: a camera left zoomed on a zone would show the wrong place.
        return { ...fresh, camera: session.focus.kind === "overview" ? session.camera : fitFocus(fresh) };
      }
      case "viewport":
      case "pan":
      case "zoom":
      case "fit":
      case "focus":
      case "reveal":
        return onView(session, action);
      default:
        return onEdit(session, action, newId);
    }
  };
}

function onHistory(session: Session, which: "undo" | "redo"): Session {
  if (session.readOnly || session.drag) return session;
  const step = which === "undo" ? undo(session.history, session.layout) : redo(session.history, session.layout);
  if (!step) return session;
  return {
    ...session,
    history: step.history,
    layout: step.layout,
    selection: session.selection.filter((id) => exists(step.layout, id)),
    vertex: null,
    notice: step.skipped ? SKIPPED_UNDO : session.notice,
  };
}

/**
 * A save reply (or a reload) arrived: lay unsaved local changes over the
 * server's layout (spec §9). A drag in progress carries on from the rebased
 * layout instead of being cancelled.
 */
function onRebase(session: Session, action: Extract<SessionAction, { type: "rebase" }>): Session {
  const rebased = rebase(session.layout, action.base, action.server, new Set(action.skip), new Set(action.sent));
  return {
    ...session,
    layout: rebased.layout,
    history: dropTouching(session.history, rebased.dropped),
    selection: session.selection.filter((id) => exists(rebased.layout, id)),
    vertex: stillThere(rebased.layout, session.vertex),
    drag: session.drag ? { ...session.drag, start: rebased.layout } : null,
    notice: action.notice ?? conflictNotice(rebased) ?? session.notice,
  };
}
