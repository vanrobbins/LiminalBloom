// Add product: products with no place yet. Each lands in the first open space
// that fits on this face; ones with no room say so instead.

"use client";

import { firstFit, presentationFor, sizeFor } from "@/lib/demo/grid";
import { working } from "@/lib/demo/reducer";
import { notPlaced } from "@/lib/demo/selectors";
import { faceOf, feet, fixtureOf, locationWords } from "@/lib/demo/words";

import { useNav } from "../demo-nav";
import { useDemoStore } from "../demo-store";
import { FOCUS, TINT } from "../looks";

type AddProductPanelProps = { fixtureId: string; faceId: string; onDone: (placementId: string | null) => void };

export function AddProductPanel({ fixtureId, faceId, onDone }: AddProductPanelProps) {
  const { state, dispatch } = useDemoStore();
  const nav = useNav();
  const placements = working(state, fixtureId);
  const face = faceOf({ fixtureId, faceId });
  const presentation = presentationFor(fixtureOf(fixtureId).kind);
  const choices = notPlaced(state).filter((p) => !placements.some((pl) => pl.productId === p.id));

  return (
    <section aria-label="Add a product" className="flex flex-col gap-2 rounded-lg border border-line bg-raised p-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Add a product</h3>
        <button type="button" onClick={() => onDone(null)} className={`min-h-11 px-2 text-sm text-brand-strong underline underline-offset-4 ${FOCUS}`}>
          Cancel
        </button>
      </div>
      {choices.length === 0 ? <p className="text-sm text-ink-muted">Every product has a place.</p> : null}
      {choices.map((product) => {
        const size = sizeFor(product, presentation);
        const spot = firstFit(face, placements, size);
        return (
          <button
            key={product.id}
            type="button"
            disabled={!spot}
            onClick={() => {
              if (!spot) return;
              const id = `pl-${state.nextId}`;
              dispatch({ type: "add", fixtureId, faceId, productId: product.id, presentation });
              nav.say(`Added ${product.name}: ${locationWords({ id, productId: product.id, fixtureId, presentation, ...spot })}`, {
                action: { label: "Undo", run: () => dispatch({ type: "undo", fixtureId }) },
              });
              onDone(id);
            }}
            className={`flex min-h-11 items-center gap-3 rounded px-2 text-left text-sm hover:bg-line-subtle disabled:opacity-60 ${FOCUS}`}
          >
            <span aria-hidden="true" className={`size-6 shrink-0 rounded ${TINT[product.tone]}`} />
            <span className="flex-1">{product.name}</span>
            <span className="text-xs text-ink-muted">{spot ? `${feet(size.w)} ft wide` : "No room on this face"}</span>
          </button>
        );
      })}
    </section>
  );
}
