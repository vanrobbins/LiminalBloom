// The palette's field and its grouped list: an ARIA combobox in the time zone search's pattern
// (components/time/zone-search.tsx). Arrows, Home and End move the highlight and choose nothing;
// Enter or a click chooses. The highlight is kept by id, so products that arrive late and slide
// rows down never change what Enter opens. Status rows (searching, failed) are not options.

"use client";

import { Search, X } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { useAnnouncement } from "@/components/ui/use-announcement";
import { describeResults, keepActive } from "@/lib/palette/groups";
import type { PaletteGroup, PaletteItem } from "@/lib/palette/types";

import { PaletteRow } from "./palette-row";
import type { ProductsState } from "./use-palette-data";

/** Quiet this long before the result count is spoken, so it isn't said per keystroke. */
const ANNOUNCE_MS = 500;
const MAX_QUERY = 80;

/** The highlight: the pinned id if still listed. A highlight nobody moved that sits on the placeholder "All products" row follows the first real product when one lands. */
function resolveActive(pinned: string | null, moved: boolean, options: readonly PaletteItem[]): string | null {
  const kept = keepActive(pinned, options);
  const firstProduct = options.find((o) => o.kind === "product");
  return !moved && kept === "all-products" && firstProduct ? firstProduct.id : kept;
}

type PaletteListProps = {
  query: string;
  onQueryChange: (query: string) => void;
  groups: PaletteGroup[];
  products: { state: ProductsState; searching: boolean };
  onPick: (item: PaletteItem) => void;
  onClose: () => void;
};

export function PaletteList({ query, onQueryChange, groups, products, onPick, onClose }: PaletteListProps) {
  const base = useId();
  const options = groups.flatMap((g) => g.items);
  const [pinned, setPinned] = useState<string | null>(null);
  const [moved, setMoved] = useState(false);
  const active = resolveActive(pinned, moved, options);
  // Adjusting state while rendering is the pattern React documents for following changed data.
  if (active !== pinned) setPinned(active);
  const activeIndex = options.findIndex((o) => o.id === active);
  const optionId = (i: number) => `${base}-option-${i}`;

  useEffect(() => {
    if (activeIndex >= 0) document.getElementById(`${base}-option-${activeIndex}`)?.scrollIntoView?.({ block: "nearest" });
  }, [base, activeIndex]);

  const [spoken, say] = useAnnouncement();
  const message = products.state !== "loading" && query.trim() ? describeResults(groups, query) : "";
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => say(message), ANNOUNCE_MS);
    return () => clearTimeout(timer);
  }, [message, say]);

  function moveTo(index: number) {
    const target = options[Math.max(0, Math.min(options.length - 1, index))];
    if (!target) return;
    setPinned(target.id);
    setMoved(true);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    // Keys while an IME is composing belong to the IME (Enter confirms a candidate, arrows move through them).
    if (event.nativeEvent.isComposing) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      moveTo(activeIndex + (event.key === "ArrowDown" ? 1 : -1));
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      moveTo(event.key === "Home" ? 0 : options.length - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (options[activeIndex]) onPick(options[activeIndex]);
    }
  }

  const noMatches = query.trim() !== "" && products.state !== "loading" && options.every((o) => o.kind === "all-products");
  // Each group's first option sits after the options of the groups before it.
  const starts = groups.map((_, g) => groups.slice(0, g).reduce((n, prev) => n + prev.items.length, 0));
  return (
    <>
      <div className="flex items-center gap-2 border-b border-line-subtle px-3 py-2">
        <Search aria-hidden="true" strokeWidth={1.75} className="size-5 shrink-0 text-ink-muted md:hidden" />
        <input
          type="text"
          role="combobox"
          aria-label="Search products, planograms, zones and pages"
          aria-expanded="true"
          aria-controls={`${base}-list`}
          aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
          aria-autocomplete="list"
          value={query}
          onChange={(event) => {
            onQueryChange(event.target.value);
            setPinned(null);
            setMoved(false);
          }}
          onKeyDown={onKeyDown}
          placeholder="Find a product, planogram, zone or page"
          maxLength={MAX_QUERY}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="go"
          className="min-h-11 min-w-0 flex-1 rounded bg-transparent px-2 text-base text-ink placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        />
        <Button variant="ghost" icon aria-label="Close" onClick={onClose}>
          <X aria-hidden="true" strokeWidth={1.75} className="size-5" />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
        {noMatches ? <p className="px-3 py-2 text-sm text-ink-muted">No matches for &ldquo;{query.trim()}&rdquo;.</p> : null}
        <div id={`${base}-list`} role="listbox" aria-label="Results" className="flex flex-col">
          {groups.map((g, gi) => (
            <div key={g.key} role="group" aria-labelledby={`${base}-${g.key}`}>
              <div id={`${base}-${g.key}`} role="presentation" className="px-3 pt-2 pb-1 text-xs font-medium text-ink-muted">
                {g.heading}
              </div>
              {g.key === "products" && products.searching ? (
                <div role="presentation" className="px-3 py-2 text-sm text-ink-muted">Searching products…</div>
              ) : null}
              {g.key === "products" && products.state === "error" ? (
                <div role="presentation" className="px-3 py-2 text-sm text-ink-muted">Couldn&rsquo;t search products. Check your connection.</div>
              ) : null}
              {g.items.map((item, i) => (
                <PaletteRow
                  key={item.id}
                  item={item}
                  id={optionId(starts[gi] + i)}
                  active={item.id === active}
                  onPick={onPick}
                  onHover={() => {
                    setPinned(item.id);
                    setMoved(true);
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <p className="hidden border-t border-line-subtle px-4 py-2 text-xs text-ink-muted lg:block">↑ ↓ to move · Enter to open · Esc to close</p>
      <p role="status" aria-live="polite" className="sr-only">
        {spoken}
      </p>
    </>
  );
}
