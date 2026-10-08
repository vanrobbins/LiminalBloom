// What the location sheet shows (spec §7.3): the product, its status, and
// every place it lives, each on the map and its face's grid.

"use client";

import { ProductImage } from "@/components/products/product-image";
import type { Layout } from "@/lib/layout/types";
import { PRESENTATION_LABEL } from "@/lib/products/footprint";
import type { ProductRow, SearchResult } from "@/lib/products/queries";

import { FaceGrid } from "./face-grid";
import { LocationMap } from "./location-map";
import { StatusControl } from "./status-control";

type LocationDetailsProps = { result: SearchResult; layout: Layout; onChanged: (product: ProductRow) => void };

export function LocationDetails({ result, layout, onChanged }: LocationDetailsProps) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-4">
        <ProductImage productId={result.id} name={result.name} categoryName={result.categoryName} imageKey={result.imageKey} size="lg" />
        <dl className="grid content-start gap-x-3 gap-y-1 text-sm [grid-template-columns:auto_1fr]">
          <dt className="text-ink-muted">Style</dt>
          <dd className="font-mono text-ink">{result.styleNumber}</dd>
          <dt className="text-ink-muted">Category</dt>
          <dd className="text-ink">{result.categoryName}</dd>
          <dt className="text-ink-muted">Color</dt>
          <dd className="text-ink">{result.color}</dd>
          {result.sizeRange ? (
            <>
              <dt className="text-ink-muted">Sizes</dt>
              <dd className="text-ink">{result.sizeRange}</dd>
            </>
          ) : null}
        </dl>
      </div>
      <StatusControl product={result} onChanged={onChanged} />
      <section aria-labelledby="where-heading" className="flex flex-col gap-4">
        <h3 id="where-heading" className="font-semibold text-ink">
          Where it goes
        </h3>
        {result.locations.length === 0 ? (
          <p className="text-ink-muted">Not placed yet. It gets a place when it goes into a planogram.</p>
        ) : (
          <ul className="flex flex-col gap-6">
            {result.locations.map((l) => (
              <li key={l.id} className="flex flex-col gap-2">
                <p className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-mono font-semibold text-ink">{l.spanLabel}</span>
                  <span className="text-sm text-ink-muted">{PRESENTATION_LABEL[l.presentation]}</span>
                </p>
                {l.floor ? (
                  <>
                    <LocationMap layout={layout} fixtureId={l.floor.fixtureId} />
                    <FaceGrid grid={l.floor.grid} cells={l.floor.cells} label={l.label.slice(0, l.label.lastIndexOf(","))} />
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
