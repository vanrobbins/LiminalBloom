// What the product panel sends (0.7.0.5 task 6): the numbers as they save, and the face picker's move. A move builds on
// the numbers just typed, not on the ones the panel was last rendered with, or it would put them back.

"use client";

import { useRef } from "react";

import type { Verb } from "@/lib/planograms/builder/fields";
import { firstOpenSpot } from "@/lib/planograms/builder/place";
import type { PlacementFields, PlacementView, PlanogramScope } from "@/lib/planograms/types";

import type { GridItem } from "./grid-items";
import { flushPendingEdits } from "./use-auto-save";
import type { CommitResult, useBuilder } from "./use-builder";

type Options = {
  scope: PlanogramScope;
  placements: readonly PlacementView[];
  builder: ReturnType<typeof useBuilder>;
  /** The screen's own change: the refusal's words, or null once it is saved. */
  change: (item: GridItem, fields: PlacementFields, verb: Verb) => Promise<string | null>;
};

export function usePanelEdits({ scope, placements, builder, change }: Options) {
  // The latest typed save still on its way: a move that follows waits for it.
  const editing = useRef<Promise<CommitResult> | null>(null);

  /**
   * The panel's numbers, saved as they change. Only the numbers: it never moves the selection, because the panel it
   * came from may be closed or on another tile by the time this lands (a flush on close or on a new pick).
   */
  function edit(p: PlacementView, fields: PlacementFields) {
    const done = builder.commit(p, fields, "Changed");
    editing.current = done;
    void done.finally(() => {
      if (editing.current === done) editing.current = null;
    });
    return done;
  }

  /** The panel's face picker: to the first open spot that fits on that face. The reason it can't shows in the panel, not a toast. */
  async function moveToFace(p: PlacementView, target: string): Promise<string | null> {
    // What is typed goes first (it has not blurred on a tap that never takes focus), and the move waits for it to land.
    const sending = flushPendingEdits();
    const inFlight = editing.current;
    await sending;
    const last = await inFlight;
    const fresh = last?.ok ? last.draft : undefined;
    const now = fresh?.placements.find((o) => o.id === p.id) ?? p;
    const to = scope.faces.find((f) => f.faceId === target);
    const spot = to ? firstOpenSpot([to], fresh?.placements ?? placements, now, now.id) : null;
    if (!spot) return `No open spot fits on ${to?.label ?? "that face"}`;
    return change(now, { ...now, ...spot }, "Moved");
  }

  return { edit, moveToFace };
}
