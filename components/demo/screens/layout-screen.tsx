// Layout: the store map. Tapping a fixture shows its published planogram
// underneath, with a way into it.

"use client";

import { useState } from "react";

import { FIXTURES, ZONES } from "@/lib/demo/seed";

import { useNav } from "../demo-nav";
import { useDemoStore } from "../demo-store";
import { FaceGrid } from "../face-grid";
import { FOCUS } from "../looks";
import { ScreenTitle } from "../screen-title";
import { StoreMap } from "../store-map";

export function LayoutScreen({ fixtureId }: { fixtureId?: string }) {
  const { state } = useDemoStore();
  const nav = useNav();
  const [picked, setPicked] = useState<string | null>(fixtureId ?? null);
  const fixture = FIXTURES.find((f) => f.id === picked);

  return (
    <>
      <ScreenTitle title="Layout" sub="Tap a fixture to see what's on it." />
      <StoreMap highlightId={picked} onPick={setPicked} />
      {fixture ? (
        <section aria-live="polite" className="flex flex-col gap-3 rounded-lg border border-line bg-raised p-3">
          <div>
            <h3 className="font-semibold">{fixture.name}</h3>
            <p className="text-sm text-ink-muted">
              {ZONES.find((z) => z.id === fixture.zoneId)?.name} · Published version {state.versions[fixture.id]} · due {fixture.due}
            </p>
          </div>
          <FaceGrid face={fixture.faces[0]} placements={state.published.filter((p) => p.fixtureId === fixture.id)} products={state.products} rowHeight="2rem" />
          <button type="button" onClick={() => nav.go({ name: "planogram", fixtureId: fixture.id })} className={`min-h-11 rounded border border-line bg-raised px-4 ${FOCUS}`}>
            Open planogram
          </button>
        </section>
      ) : null}
    </>
  );
}
