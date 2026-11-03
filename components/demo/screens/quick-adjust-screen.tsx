// Quick Adjust: a sold-out product's space, the products that fit it, and the
// display before and after. A VM Lead publishes; a Sales Associate can only
// send it for review. Publishing marks the spot as adjusted on the planogram.

"use client";

import { useState } from "react";

import { sizeFor } from "@/lib/demo/grid";
import { productOf, soldOutOnDisplay, suggestionsFor } from "@/lib/demo/selectors";
import type { Placement } from "@/lib/demo/types";
import { faceOf, feet, locationWords, placeWords, spanWords } from "@/lib/demo/words";

import { useNav } from "../demo-nav";
import { useDemoStore } from "../demo-store";
import { FaceGrid } from "../face-grid";
import { FOCUS, TINT } from "../looks";
import { ScreenTitle } from "../screen-title";
import { StatusChip } from "../status-chip";

export function QuickAdjustScreen({ placementId }: { placementId?: string }) {
  const { state, dispatch } = useDemoStore();
  const nav = useNav();
  const gap = state.published.find((p) => p.id === placementId);
  const [pick, setPick] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  if (!gap || productOf(state, gap.productId).status !== "sold_out") {
    const gaps = soldOutOnDisplay(state);
    return (
      <>
        <ScreenTitle title="Quick Adjust" sub="Sold-out products still taking space on a display." onBack={() => nav.go({ name: "home" })} backLabel="Home" />
        {gaps.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line p-3 text-sm">
            Nothing to adjust. Mark a product sold out in Products and its space shows up here.
          </p>
        ) : (
          gaps.map((g) => (
            <button key={g.id} type="button" onClick={() => nav.go({ name: "quick-adjust", placementId: g.id })} className={`flex items-center gap-3 rounded-lg border border-line bg-raised p-3 text-left ${FOCUS}`}>
              <StatusChip status="sold_out" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{productOf(state, g.productId).name}</span>
                <span className="block text-sm text-ink-muted">{locationWords(g)}</span>
              </span>
            </button>
          ))
        )}
      </>
    );
  }

  const gone = productOf(state, gap.productId);
  const suggestions = suggestionsFor(state, gap);
  const chosen = suggestions.find((p) => p.id === pick) ?? null;
  const onFixture = state.published.filter((p) => p.fixtureId === gap.fixtureId);
  const after: Placement[] = chosen
    ? onFixture.map((p) => (p.id === gap.id ? { ...p, ...sizeFor(chosen, gap.presentation), productId: chosen.id, adjusted: true } : p))
    : onFixture;
  const isLead = state.role === "vm-lead";

  return (
    <>
      <ScreenTitle title="Quick Adjust" sub={placeWords(gap)} onBack={() => nav.go({ name: "quick-adjust" })} backLabel="All sold-out spaces" />
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <StatusChip status="sold_out" />
        {gone.name} leaves {feet(gap.w)} ft open, {spanWords(gap)}.
      </p>

      <div className="grid gap-3 @xl:grid-cols-2">
        <figure className="flex flex-col gap-1">
          <figcaption className="text-xs text-ink-muted">Now</figcaption>
          <FaceGrid face={faceOf(gap)} placements={onFixture} products={state.products} markedId={gap.id} rowHeight="2rem" />
        </figure>
        <figure className="flex flex-col gap-1">
          <figcaption className="text-xs text-ink-muted">{chosen ? `With ${chosen.name}` : "Pick a replacement"}</figcaption>
          <FaceGrid face={faceOf(gap)} placements={after} products={state.products} markedId={gap.id} rowHeight="2rem" />
        </figure>
      </div>

      <section className="flex flex-col gap-1 rounded-lg border border-line bg-raised p-3">
        <h3 className="mb-1 font-semibold">Fits the space</h3>
        {suggestions.length === 0 ? <p className="text-sm text-ink-muted">Nothing in stock from the same category or colour fits here.</p> : null}
        <div role="radiogroup" aria-label="Replacement" className="flex flex-col gap-1">
          {suggestions.map((product) => (
            <button
              key={product.id}
              type="button"
              role="radio"
              aria-checked={pick === product.id}
              onClick={() => setPick(product.id)}
              className={`flex min-h-11 items-center gap-3 rounded px-2 text-left text-sm ${pick === product.id ? "bg-brand font-medium text-on-brand" : "hover:bg-line-subtle"} ${FOCUS}`}
            >
              <span aria-hidden="true" className={`size-5 shrink-0 rounded ${TINT[product.tone]}`} />
              <span className="flex-1">
                {product.name} · {product.colour}
              </span>
              <span>{feet(sizeFor(product, gap.presentation).w)} ft</span>
            </button>
          ))}
        </div>
      </section>

      {sent ? <p className="text-sm">Sent to a VM Lead for review. Switch to VM Lead in Account to publish it.</p> : null}
      <button
        type="button"
        disabled={!chosen}
        onClick={() => {
          if (!chosen) return;
          if (!isLead) {
            setSent(true);
            return;
          }
          dispatch({ type: "adjust", placementId: gap.id, productId: chosen.id });
          nav.say(`${chosen.name} now fills the space. Everyone sees it in Products.`);
          nav.go({ name: "products" });
          nav.openSheet(chosen.id);
        }}
        className={`min-h-11 rounded bg-brand px-4 font-medium text-on-brand disabled:opacity-50 ${FOCUS}`}
      >
        {isLead ? "Publish adjustment" : "Submit for review"}
      </button>
    </>
  );
}
