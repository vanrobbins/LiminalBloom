// A product's sheet: slides up from the bottom when narrow, a side panel when
// wide. Status changes save at once with Undo; the location reads in words,
// on the map and on the fixture's face.

"use client";

import { X } from "lucide-react";

import { placementOf, productOf } from "@/lib/demo/selectors";
import type { Status } from "@/lib/demo/types";
import { faceOf, locationWords } from "@/lib/demo/words";

import { useNav } from "./demo-nav";
import { useDemoStore } from "./demo-store";
import { FaceGrid } from "./face-grid";
import { FOCUS, STATUS_LOOK } from "./looks";
import { StoreMap } from "./store-map";

const STATUSES: Status[] = ["in_stock", "sold_out", "on_sale"];

export function ProductSheet() {
  const { state, dispatch } = useDemoStore();
  const nav = useNav();
  if (!nav.sheet) return null;

  const product = productOf(state, nav.sheet);
  const placement = placementOf(state, product.id);

  function setStatus(status: Status) {
    const before = product.status;
    if (status === before) return;
    dispatch({ type: "status", productId: product.id, status });
    nav.say(`${product.name}: ${STATUS_LOOK[status].word.toLowerCase()}`, {
      action: { label: "Undo", run: () => dispatch({ type: "status", productId: product.id, status: before }) },
    });
  }

  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-end @3xl:flex-row @3xl:justify-end">
      <button type="button" aria-label="Close" onClick={nav.closeSheet} className="absolute inset-0 bg-scrim" />
      <section
        role="dialog"
        aria-label={product.name}
        className="relative flex max-h-[88%] flex-col gap-3 overflow-y-auto rounded-t-2xl border-t border-line bg-raised p-4 shadow-xl @3xl:max-h-none @3xl:w-96 @3xl:rounded-none @3xl:border-t-0 @3xl:border-l"
      >
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-semibold">
            {product.name} <span className="font-mono text-xs font-normal text-ink-muted">{product.style}</span>
          </h2>
          <button type="button" aria-label="Close" onClick={nav.closeSheet} className={`-m-2 flex size-11 shrink-0 items-center justify-center rounded ${FOCUS}`}>
            <X aria-hidden="true" strokeWidth={1.75} className="size-5" />
          </button>
        </div>
        <p className="-mt-2 text-sm text-ink-muted">
          {product.category} · {product.colour}
        </p>

        <div role="radiogroup" aria-label="Status" className="grid grid-cols-3 rounded-lg border border-line p-0.5">
          {STATUSES.map((status) => {
            const { word, icon: Icon } = STATUS_LOOK[status];
            const isOn = product.status === status;
            return (
              <button
                key={status}
                type="button"
                role="radio"
                aria-checked={isOn}
                onClick={() => setStatus(status)}
                className={`flex min-h-11 items-center justify-center gap-1 rounded-md text-sm ${isOn ? "bg-brand font-semibold text-on-brand" : "text-ink-muted"} ${FOCUS}`}
              >
                {isOn ? <Icon aria-hidden="true" strokeWidth={2} className="size-4" /> : null}
                {word}
              </button>
            );
          })}
        </div>

        {placement ? (
          <>
            <p className="font-medium">
              {locationWords(placement)} <span className="font-normal text-ink-muted">· {placement.presentation === "hung" ? "Hung" : "Folded"}</span>
            </p>
            <StoreMap highlightId={placement.fixtureId} compact />
            <FaceGrid face={faceOf(placement)} placements={state.published.filter((p) => p.fixtureId === placement.fixtureId)} products={state.products} markedId={placement.id} rowHeight="2rem" />
            {product.status === "sold_out" ? (
              <button type="button" onClick={() => nav.go({ name: "quick-adjust", placementId: placement.id })} className={`min-h-11 rounded bg-brand px-4 font-medium text-on-brand ${FOCUS}`}>
                Fill its space with Quick Adjust
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => nav.go({ name: "planogram", fixtureId: placement.fixtureId, faceId: placement.faceId, selectId: placement.id })}
              className={`min-h-11 rounded border border-line bg-raised px-4 ${FOCUS}`}
            >
              Open planogram
            </button>
          </>
        ) : (
          <p className="rounded-lg border border-dashed border-line p-3 text-sm">
            Not placed yet. A VM Lead can add it to a planogram, and it lands in the first open space that fits.
          </p>
        )}
      </section>
    </div>
  );
}
