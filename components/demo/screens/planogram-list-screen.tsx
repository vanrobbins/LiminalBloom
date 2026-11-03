// Planograms: one per fixture, with its version, any draft, and its due date.

"use client";

import { ChevronRight } from "lucide-react";

import { FIXTURES, ZONES } from "@/lib/demo/seed";

import { useNav } from "../demo-nav";
import { useDemoStore } from "../demo-store";
import { FOCUS } from "../looks";
import { ScreenTitle } from "../screen-title";

export function PlanogramListScreen() {
  const { state } = useDemoStore();
  const nav = useNav();

  return (
    <>
      <ScreenTitle title="Planograms" sub="One per fixture." />
      <ul className="flex flex-col gap-2">
        {FIXTURES.map((fixture) => {
          const changes = state.undo[fixture.id]?.length ?? 0;
          return (
            <li key={fixture.id}>
              <button type="button" onClick={() => nav.go({ name: "planogram", fixtureId: fixture.id })} className={`flex w-full items-center gap-3 rounded-lg border border-line bg-raised p-3 text-left hover:border-ink ${FOCUS}`}>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{fixture.name}</span>
                  <span className="block text-sm text-ink-muted">
                    {ZONES.find((z) => z.id === fixture.zoneId)?.name} · v{state.versions[fixture.id]} · due {fixture.due}
                  </span>
                </span>
                {changes > 0 ? <span className="rounded-full bg-line-subtle px-2 py-0.5 text-xs">Draft · {changes}</span> : null}
                <ChevronRight aria-hidden="true" strokeWidth={1.75} className="size-5 shrink-0 text-ink-muted" />
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
