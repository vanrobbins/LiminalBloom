// What the location sheet shows (spec §7.3): the product, its status, and
// every place it lives, each on the map and its face's grid.

"use client";

import { Zap } from "lucide-react";
import Link from "next/link";

import { ProductImage } from "@/components/products/product-image";
import { InfoPopover } from "@/components/ui/info-popover";
import { Button } from "@/components/ui/button";
import { can, type Holder } from "@/lib/access/can";
import type { Layout } from "@/lib/layout/types";
import { PRESENTATION_LABEL } from "@/lib/products/footprint";
import type { ProductRow, SearchResult } from "@/lib/products/queries";

import { FaceGrid } from "./face-grid";
import { LocationMap } from "./location-map";
import { StatusControl } from "./status-control";

type LocationDetailsProps = { result: SearchResult; layout: Layout; member: Holder; onChanged: (product: ProductRow) => void };

export function LocationDetails({ result, layout, member, onChanged }: LocationDetailsProps) {
  // Quick Adjust (0.7.0.9): a sold-out or on-sale product's floor places link to the adjust page for those who may draft.
  const canDraft = can(member, "planograms.draft");
  const canAdjust = canDraft && result.status !== "in_stock";
  const off = result.adjustedOff ?? [];
  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-4">
        <ProductImage productId={result.id} name={result.name} categoryName={result.categoryName} imageKey={result.imageKey} swatch={result.swatch} texture={result.texture} colorWord={result.color} size="lg" />
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
      <StatusControl product={result} member={member} onChanged={onChanged} displays={result.locations.filter((l) => l.floor).length} />
      <section aria-labelledby="where-heading" className="flex flex-col gap-4">
        <h3 id="where-heading" className="font-semibold text-ink">
          Where it goes
        </h3>
        {off.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {off.map((o) => (
              <li key={o.fixtureId} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-ink">Off {o.fixtureName} for a Quick Adjust</span>
                {canDraft ? (
                  <Button asChild icon variant="secondary">
                    <Link href={`/planograms/${o.fixtureId}/adjust?product=${result.id}`} aria-label={`Quick Adjust on ${o.fixtureName}`}>
                      <Zap aria-hidden="true" strokeWidth={1.75} className="size-5" />
                    </Link>
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        {result.locations.length === 0 ? (
          off.length > 0 ? null : <p className="text-ink-muted">Not placed yet. It gets a place when it goes into a planogram.</p>
        ) : (
          <ul className="flex flex-col gap-6">
            {result.locations.map((l) => (
              <li key={l.id} className="flex flex-col gap-2">
                <p className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold text-ink">{l.label}</span>
                  <span className="text-sm text-ink-muted">{PRESENTATION_LABEL[l.presentation]}</span>
                </p>
                {l.detail ? (
                  <p className="flex items-center gap-1 text-sm text-ink-muted">
                    {l.detail}
                    {l.detail.startsWith("Rail ·") ? <InfoPopover term="rail" /> : null}
                  </p>
                ) : null}
                {l.behind ? <p className="text-sm text-ink-muted">{l.behind}</p> : null}
                {l.floor ? (
                  <>
                    <LocationMap layout={layout} fixtureId={l.floor.fixtureId} />
                    <FaceGrid grid={l.floor.grid} cells={l.floor.cells} label={`${l.label}, ${l.detail}`} />
                    <div className="flex items-center gap-3 self-start">
                      <Link
                        href={`/planograms/${l.floor.fixtureId}?product=${result.id}`}
                        className="inline-flex min-h-11 items-center text-ink underline underline-offset-4"
                      >
                        Open planogram
                      </Link>
                      {canAdjust ? (
                        <Button asChild icon variant="secondary">
                          <Link href={`/planograms/${l.floor.fixtureId}/adjust?product=${result.id}`} aria-label={`Quick Adjust on ${l.label}`}>
                            <Zap aria-hidden="true" strokeWidth={1.75} className="size-5" />
                          </Link>
                        </Button>
                      ) : null}
                    </div>
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
