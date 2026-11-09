// Add product (Part 2 spec §4 "Add"): find it with the library's search;
// picking it places it at the first open spot that fits (the shown face first),
// selected and scrolled into view, with focus on it (its opener, Add product,
// is hidden on a phone once a tile is selected). "Edit numbers" changes its place after.
// Products show A–Z before anything is typed, and on a phone it's a bottom
// sheet like everything else there (UX audit U23).

"use client";

import { useEffect, useRef, useState } from "react";

import { pickerSearch } from "@/app/(app)/planograms/actions";
import { PHONE_QUERY, useMediaQuery } from "@/components/store-map/use-media-query";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ProductFit } from "@/lib/planograms/types";

type AddProductDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Resolves to why it couldn't be placed, or null once it has been. */
  onPick: (product: ProductFit) => Promise<string | null>;
  /** On closing: `event.preventDefault()` to focus the placed tile instead of the opener. */
  onCloseAutoFocus?: (event: Event) => void;
};

export function AddProductDialog({ open, onOpenChange, onPick, onCloseAutoFocus }: AddProductDialogProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductFit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [placing, setPlacing] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPhone = useMediaQuery(PHONE_QUERY);

  // Something to pick from straight away; typing narrows it.
  useEffect(() => {
    if (!open) return;
    let live = true;
    pickerSearch("")
      .then((rows) => {
        if (live) setResults((shown) => (shown.length ? shown : rows));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [open]);

  function search(text: string) {
    setQuery(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      pickerSearch(text).then(setResults).catch(() => setResults([]));
    }, 200);
  }

  function close(next: boolean) {
    if (!next) {
      if (timer.current) clearTimeout(timer.current);
      setQuery("");
      setResults([]);
      setError(null);
    }
    onOpenChange(next);
  }

  async function pick(product: ProductFit) {
    setPlacing(product.id);
    const refusal = await onPick(product);
    setPlacing(null);
    if (refusal) setError(refusal);
    else close(false);
  }

  const body = (
    <div className="flex flex-col gap-3">
      <Input label="Find a product" type="search" value={query} onChange={(e) => search(e.target.value)} autoFocus={!isPhone} />
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <ul className="flex max-h-72 flex-col overflow-y-auto">
        {results.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => void pick(p)}
              disabled={placing !== null}
              aria-busy={placing === p.id || undefined}
              className="flex min-h-11 w-full flex-col items-start border-b border-line-subtle py-2 text-left disabled:opacity-60"
            >
              <span className="text-ink">{p.name}</span>
              <span className="font-mono text-sm text-ink-muted">{p.styleNumber}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );

  if (isPhone) {
    return (
      <BottomSheet open={open} onOpenChange={close} title="Add product" tall onCloseAutoFocus={onCloseAutoFocus}>
        <p className="mb-3 text-sm text-ink-muted">It goes to the first open spot that fits.</p>
        {body}
      </BottomSheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={close} title="Add product" description="It goes to the first open spot that fits." onCloseAutoFocus={onCloseAutoFocus}>
      {body}
    </Dialog>
  );
}
