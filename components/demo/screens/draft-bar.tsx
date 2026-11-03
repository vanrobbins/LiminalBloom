// The planogram's draft controls: what state it's in, Undo, Add product,
// Discard and Publish. Publishing makes the draft what search answers from.

"use client";

import { Plus, Undo2 } from "lucide-react";

import { fixtureOf } from "@/lib/demo/words";

import { useNav } from "../demo-nav";
import { useDemoStore } from "../demo-store";
import { FOCUS } from "../looks";

const SECONDARY = `inline-flex min-h-11 items-center gap-1.5 rounded border border-line bg-raised px-3 text-sm disabled:opacity-50 ${FOCUS}`;

export function DraftBar({ fixtureId, onAdd }: { fixtureId: string; onAdd: () => void }) {
  const { state, dispatch } = useDemoStore();
  const nav = useNav();
  const changes = state.undo[fixtureId]?.length ?? 0;
  const version = state.versions[fixtureId];

  return (
    <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-2 border-t border-line bg-raised px-4 py-2.5">
      <span className="mr-auto text-sm text-ink-muted">{changes > 0 ? `Draft · ${changes} change${changes === 1 ? "" : "s"}` : `Published version ${version}`}</span>
      <button type="button" onClick={onAdd} className={SECONDARY}>
        <Plus aria-hidden="true" strokeWidth={1.75} className="size-4" />
        Add product
      </button>
      <button type="button" disabled={changes === 0} onClick={() => dispatch({ type: "undo", fixtureId })} className={SECONDARY}>
        <Undo2 aria-hidden="true" strokeWidth={1.75} className="size-4" />
        Undo
      </button>
      {changes > 0 ? (
        <>
          <button
            type="button"
            onClick={() => {
              dispatch({ type: "discard", fixtureId });
              nav.say("Draft discarded. The published version is unchanged.");
            }}
            className={SECONDARY}
          >
            Discard
          </button>
          <button
            type="button"
            onClick={() => {
              dispatch({ type: "publish", fixtureId });
              nav.say(`Published version ${version + 1} of the ${fixtureOf(fixtureId).name}. Search shows it now.`);
            }}
            className={`min-h-11 rounded bg-brand px-4 text-sm font-medium text-on-brand ${FOCUS}`}
          >
            Publish
          </button>
        </>
      ) : null}
    </div>
  );
}
