// Session builders for tests. Not imported by app code.

import { createReducer } from "./session";
import { createSession, type Session } from "./session-core";
import type { Layout } from "./types";

/** Screen pixels equal store inches, so tests can reason in one unit. */
export function editing(layout: Layout, readOnly = false): Session {
  return { ...createSession(layout, readOnly), camera: { x: 0, y: 0, scale: 1 }, viewport: { width: 800, height: 600 } };
}

/** A reducer whose new ids are new-1, new-2, … */
export function reducer() {
  let n = 0;
  return createReducer(() => `new-${++n}`);
}
