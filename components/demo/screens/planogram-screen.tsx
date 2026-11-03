// A fixture's planogram. A VM Lead drags tiles (or selects one and uses the
// arrow keys), adds products into the first open space, undoes, and publishes;
// the first change starts a draft. A Sales Associate sees it read-only.

"use client";

import { useState } from "react";

import { checkSpot } from "@/lib/demo/grid";
import { working } from "@/lib/demo/reducer";
import { productOf } from "@/lib/demo/selectors";
import { fixtureOf, locationWords } from "@/lib/demo/words";

import { useNav } from "../demo-nav";
import { useDemoStore } from "../demo-store";
import { FaceGrid } from "../face-grid";
import { FOCUS } from "../looks";
import { ScreenTitle } from "../screen-title";
import { StatusChip } from "../status-chip";
import { AddProductPanel } from "./add-product-panel";
import { DraftBar } from "./draft-bar";

type PlanogramScreenProps = { fixtureId: string; faceId?: string; selectId?: string };

export function PlanogramScreen({ fixtureId, faceId, selectId }: PlanogramScreenProps) {
  const { state, dispatch } = useDemoStore();
  const nav = useNav();
  const fixture = fixtureOf(fixtureId);
  const [faceShown, setFaceShown] = useState(faceId ?? fixture.faces[0].id);
  const [selected, setSelected] = useState<string | null>(selectId ?? null);
  const [adding, setAdding] = useState(false);

  const face = fixture.faces.find((f) => f.id === faceShown) ?? fixture.faces[0];
  const placements = working(state, fixtureId);
  const chosen = placements.find((p) => p.id === selected);
  const isLead = state.role === "vm-lead";

  function move(placementId: string, col: number, row: number) {
    const moving = placements.find((p) => p.id === placementId);
    if (!moving) return;
    const name = productOf(state, moving.productId).name;
    const check = checkSpot(face, placements.filter((p) => p.id !== placementId), { faceId: face.id, col, row, w: moving.w, h: moving.h });
    if (!check.ok) {
      const why = check.reason === "edge" ? `That's past the edge of the ${fixture.name}` : `Blocked by ${productOf(state, check.by.productId).name}`;
      nav.say(`${why}. ${name} stays where it was.`, { tone: "refused" });
      return;
    }
    dispatch({ type: "move", placementId, fixtureId, faceId: face.id, col, row });
    setSelected(placementId);
    nav.say(`Moved ${name}`, { action: { label: "Undo", run: () => dispatch({ type: "undo", fixtureId }) } });
  }

  return (
    <>
      <ScreenTitle title={fixture.name} sub={`Due ${fixture.due}`} onBack={() => nav.go({ name: "planograms" })} backLabel="All planograms" />

      {fixture.faces.length > 1 ? (
        <div role="radiogroup" aria-label="Face" className="inline-flex self-start rounded-lg border border-line p-0.5">
          {fixture.faces.map((f) => (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={f.id === face.id}
              onClick={() => setFaceShown(f.id)}
              className={`min-h-10 rounded-md px-4 text-sm ${f.id === face.id ? "bg-brand font-semibold text-on-brand" : "text-ink-muted"} ${FOCUS}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      ) : null}

      <div>
        <div aria-hidden="true" className="mb-1 flex justify-between font-mono text-[0.625rem] text-ink-muted">
          <span>0</span>
          <span>{face.cols / 2} ft</span>
        </div>
        <FaceGrid
          face={face}
          placements={placements}
          products={state.products}
          markedId={selected}
          editable={isLead}
          onSelect={(id) => setSelected((now) => (now === id ? null : id))}
          onMove={move}
        />
      </div>

      {chosen ? (
        <section aria-live="polite" className="flex flex-col gap-2 rounded-lg border border-brand bg-raised p-3">
          <div className="flex items-start justify-between gap-2">
            <span>
              <span className="block font-medium">{productOf(state, chosen.productId).name}</span>
              <span className="block text-sm text-ink-muted">{locationWords(chosen)}</span>
            </span>
            <StatusChip status={productOf(state, chosen.productId).status} />
          </div>
          {isLead ? <p className="text-sm text-ink-muted">Drag it, or use the arrow keys, to move it.</p> : null}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => nav.openSheet(chosen.productId)} className={`min-h-11 flex-1 rounded border border-line px-3 text-sm ${FOCUS}`}>
              Product details
            </button>
            {isLead ? (
              <button
                type="button"
                onClick={() => {
                  dispatch({ type: "remove", fixtureId, placementId: chosen.id });
                  setSelected(null);
                  nav.say(`Removed ${productOf(state, chosen.productId).name}`, { action: { label: "Undo", run: () => dispatch({ type: "undo", fixtureId }) } });
                }}
                className={`min-h-11 flex-1 rounded border border-line px-3 text-sm ${FOCUS}`}
              >
                Remove
              </button>
            ) : null}
          </div>
        </section>
      ) : (
        <p className="text-sm text-ink-muted">
          {isLead ? "Tap a product to select it, or drag it to a new spot." : "View only. VM Leads change displays; switch roles in Account to try it."}
        </p>
      )}

      {isLead && adding ? (
        <AddProductPanel fixtureId={fixtureId} faceId={face.id} onDone={(id) => { setAdding(false); if (id) setSelected(id); }} />
      ) : null}
      {isLead ? <DraftBar fixtureId={fixtureId} onAdd={() => setAdding(true)} /> : null}
    </>
  );
}
