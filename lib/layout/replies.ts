// What the editor's server actions answer. Types only, so the browser can
// import them without pulling in any server code.

import type { Issue, Layout } from "./types";

export type SaveResult =
  | { status: "saved"; layout: Layout }
  | { status: "conflict"; conflicts: string[]; layout: Layout }
  | { status: "invalid"; issues: Issue[]; layout: Layout };

export type SaveReply =
  | SaveResult
  | { status: "rejected"; layout: Layout }
  | { status: "signed-out" }
  | { status: "store-changed" };

export type FetchReply = { status: "ok"; layout: Layout } | { status: "signed-out" } | { status: "store-changed" };
