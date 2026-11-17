// Which draft a change works in, and which placement it is for (Part 2 spec §4; split out of use-builder.ts): the draft
// held, or one started now, once however many ask. A start that another device got to first adopts its draft, and the
// tile is found in it, or the change is refused (Review Focus 3).

"use client";

import { useRef, type RefObject } from "react";

import { beginDraftAction } from "@/app/(app)/planograms/actions";
import { matchPlacement } from "@/lib/planograms/builder/match";
import type { DraftState, PlacementView } from "@/lib/planograms/types";

import type { GridItem } from "./grid-items";
import { CONFLICT } from "./use-history";

type Options = {
  fixtureId: string;
  expectedVersion: number | null;
  adopt: (draft: DraftState) => void;
  onStarted: () => void;
  /** The first change was refused with no draft to work in: this screen is out of date, so reload it. */
  onStale: () => void;
  /** The builder's `latest`: the draft held is read from it, and a started draft is written to it before React renders. */
  latest: RefObject<{ draft: DraftState | null }>;
};

export function useDraftToUse({ fixtureId, expectedVersion, adopt, onStarted, onStale, latest }: Options) {
  // One start at a time: a second change before it's back waits for the same reply.
  const starting = useRef<ReturnType<typeof beginDraftAction> | null>(null);
  /** The draft to work in: the one held, or one started now (a change or an add with none), once however many ask. */
  async function draftToUse(): Promise<{ draft: DraftState } | { message: string | null }> {
    const held = latest.current.draft;
    if (held) return { draft: held };
    let pending = starting.current;
    if (!pending) {
      pending = beginDraftAction(fixtureId, expectedVersion).then((reply) => {
        if (reply.draft) {
          adopt(reply.draft);
          latest.current = { ...latest.current, draft: reply.draft };
          onStarted();
        } else if (reply.status === "refused") {
          // Published or discarded elsewhere since this page loaded: every later change would be refused too.
          onStale();
        }
        return reply;
      });
      starting.current = pending;
      pending
        .finally(() => {
          starting.current = null;
        })
        .catch(() => {});
    }
    const reply = await pending;
    return reply.draft ? { draft: reply.draft } : { message: reply.message };
  }

  async function placementFor(item: GridItem): Promise<{ placement: PlacementView } | { message: string | null }> {
    const held = latest.current.draft;
    if (held) {
      const placement = held.placements.find((p) => p.id === item.id);
      return placement ? { placement } : { message: CONFLICT };
    }
    const started = await draftToUse();
    if (!("draft" in started)) return started;
    const placement = matchPlacement(item, started.draft.placements);
    return placement ? { placement } : { message: CONFLICT };
  }

  return { draftToUse, placementFor };
}
