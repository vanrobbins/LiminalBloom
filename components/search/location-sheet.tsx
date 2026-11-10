// The location sheet (spec §7.3): a bottom sheet on phones, a panel beside the
// results on tablet and desktop.

"use client";

import { Pencil, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { PHONE_QUERY, useMediaQuery } from "@/components/store-map/use-media-query";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import type { Layout } from "@/lib/layout/types";
import type { ProductRow, SearchResult } from "@/lib/products/queries";

import { LocationDetails } from "./location-details";

type LocationSheetProps = {
  result: SearchResult | null;
  layout: Layout;
  onClose: () => void;
  onChanged: (product: ProductRow) => void;
};

/** To the product's own page, from the sheet's header (Week 6.5 spec §2.2). */
function EditLink({ productId }: { productId: string }) {
  return (
    <Button asChild variant="secondary" className="shrink-0">
      <Link href={`/products/${productId}`}>
        <Pencil aria-hidden="true" strokeWidth={1.75} className="size-4" />
        Edit product
      </Link>
    </Button>
  );
}

export function LocationSheet({ result, layout, onClose, onChanged }: LocationSheetProps) {
  const isPhone = useMediaQuery(PHONE_QUERY);
  const heading = useRef<HTMLHeadingElement>(null);
  const openId = result?.id ?? null;

  // The side panel is not modal: focus moves to its heading when a product
  // opens, so a keyboard or screen-reader user lands on what they chose.
  useEffect(() => {
    if (openId && !isPhone) heading.current?.focus();
  }, [openId, isPhone]);

  if (isPhone) {
    return (
      <BottomSheet open={result !== null} onOpenChange={(open) => (open ? null : onClose())} title={result?.name ?? "Product"}>
        {result ? (
          <div className="flex flex-col gap-4">
            <div className="self-start">
              <EditLink productId={result.id} />
            </div>
            <LocationDetails result={result} layout={layout} onChanged={onChanged} />
          </div>
        ) : null}
      </BottomSheet>
    );
  }
  if (!result) return null;
  return (
    <aside
      aria-label={result.name}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
      className="sticky top-6 flex max-h-[calc(100dvh-3rem)] flex-col gap-4 overflow-y-auto rounded-lg border border-line-subtle bg-raised p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 ref={heading} tabIndex={-1} className="text-xl font-semibold tracking-tight text-ink wrap-break-word outline-none">
          {result.name}
        </h2>
        <div className="flex shrink-0 items-center gap-1">
          <EditLink productId={result.id} />
          <Button variant="ghost" icon onClick={onClose} aria-label="Close">
            <X aria-hidden="true" strokeWidth={1.75} className="size-5" />
          </Button>
        </div>
      </div>
      <LocationDetails result={result} layout={layout} onChanged={onChanged} />
    </aside>
  );
}
