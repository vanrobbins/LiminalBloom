// One product on the planogram (spec §4.2): a bottom sheet on phones, a panel
// beside the grid on larger screens. While editing, it also holds the
// placement editor (move, resize, pieces, remove).
//
// The panel is not a dialog, so nothing hands focus back when it closes: it
// does that itself, to whatever opened it (the tile or card), when focus
// would otherwise drop to the page. Escape closes it while focus is inside.

"use client";

import { Search, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { ProductImage } from "@/components/products/product-image";
import { PHONE_QUERY, useMediaQuery } from "@/components/store-map/use-media-query";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { PRESENTATION_LABEL } from "@/lib/products/footprint";
import { spanLabel } from "@/lib/products/location-label";

import type { GridItem } from "./grid-items";

type ProductSheetProps = { open: boolean; item: GridItem | null; onClose: () => void; children?: React.ReactNode };

export function ProductSheet({ open, item, onClose, children }: ProductSheetProps) {
  const isPhone = useMediaQuery(PHONE_QUERY);
  const title = item?.productName ?? "Placement";
  // The product shown last: another tile may have been picked while it was open.
  const shownId = useRef<string | null>(null);
  useEffect(() => {
    shownId.current = item?.id ?? null;
  });

  useEffect(() => {
    if (isPhone || !open) return;
    // Runs after the click or Enter that opened it, so this is the opener.
    const opener = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
    return () => {
      // Only when focus was lost with the panel: never pull it from where the person went.
      if (document.activeElement && document.activeElement !== document.body) return;
      const id = shownId.current;
      const tile = id ? document.querySelector<HTMLElement>(`[data-placement="${CSS.escape(id)}"]`) : null;
      (tile ?? (opener?.isConnected ? opener : null))?.focus();
    };
  }, [isPhone, open]);

  const body = (
    <div className="flex flex-col gap-4">
      {item ? (
        <>
          <div className="flex gap-4">
            <ProductImage productId={item.productId} name={item.productName} categoryName={item.categoryName} imageKey={item.imageKey} size="lg" />
            <dl className="grid content-start grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
              <dt className="text-ink-muted">Style</dt>
              <dd className="font-mono text-ink">{item.styleNumber}</dd>
              <dt className="text-ink-muted">Cells</dt>
              <dd className="font-mono whitespace-nowrap text-ink">{spanLabel(item)}</dd>
              <dt className="text-ink-muted">How</dt>
              <dd className="text-ink">{PRESENTATION_LABEL[item.presentation]}</dd>
              <dt className="text-ink-muted">Pieces</dt>
              <dd className="font-mono text-ink">{item.pieceCount}</dd>
            </dl>
          </div>
          <Button asChild variant="secondary" className="self-start">
            <Link href={`/search?q=${encodeURIComponent(item.styleNumber)}`}>
              <Search aria-hidden="true" strokeWidth={1.75} className="size-4" />
              Find in Search
            </Link>
          </Button>
        </>
      ) : null}
      {children}
    </div>
  );

  if (isPhone) {
    return (
      <BottomSheet open={open} onOpenChange={(next) => (next ? null : onClose())} title={title}>
        {body}
      </BottomSheet>
    );
  }
  if (!open) return null;
  return (
    <aside
      aria-label={title}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
      className="flex flex-col gap-4 rounded-lg border border-line-subtle bg-raised p-5 motion-safe:animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight text-ink wrap-anywhere">{title}</h2>
        <Button variant="secondary" icon onClick={onClose} aria-label="Close">
          <X aria-hidden="true" strokeWidth={1.75} className="size-5" />
        </Button>
      </div>
      {body}
    </aside>
  );
}
