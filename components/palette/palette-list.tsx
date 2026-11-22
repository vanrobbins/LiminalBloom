// The palette's field and its grouped list: an ARIA combobox in the time zone search's pattern
// (components/time/zone-search.tsx). Arrows, Home and End move the highlight and choose nothing;
// Enter or a click chooses. The highlight is kept by id, so products that arrive late and slide
// rows down never change what Enter opens. Status rows (searching, failed) are not options.

"use client";

import { Search, X } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { useAnnouncement } from "@/components/ui/use-announcement";
import { ALL_PRODUCTS_ID, describeResults, keepActive } from "@/lib/palette/groups";
import type { PaletteGroup, PaletteItem } from "@/lib/palette/types";

import { PaletteRow } from "./palette-row";
import type { ProductsState } from "./use-palette-data";

/** Quiet this long before the result count is spoken, so it isn't said per keystroke. */
const ANNOUNCE_MS = 500;
const MAX_QUERY = 80;

type PaletteListProps = {
  query: string;
  onQueryChange: (query: string) => void;
  groups: PaletteGroup[];
  products: { state: ProductsState; searching: boolean };
  onPick: (item: PaletteItem) => void;
  onClose: () => void;
};

/**
 * The highlight: the pinned id while it is listed, else the first option, skipping "All products" (typing "store" wants the
 * Store page). While the product answer is on its way and "All products" is all there is, nothing is highlighted: it is
 * never shown highlighted just to jump to the first product when the answer lands, so Enter can't open a row that
 * slid in. Once settled it is highlighted and stays. A planogram, zone or page matched in the browser (the index can land
 * late) is what the person typed for, so an unmoved highlight on "All products" gives way to the first of those.
 */
function resolveActive(pinned: string | null, moved: boolean, options: readonly PaletteItem[], waiting: boolean): string | null {
  if (pinned === ALL_PRODUCTS_ID && !moved) {
    const instant = options.find((o) => o.kind !== "all-products" && o.kind !== "product");
    if (instant) return instant.id;
  }
  if (waiting && !moved && options.every((o) => o.kind === "all-products")) return null;
  return keepActive(pinned, options);
}

export function PaletteList({ query, onQueryChange, groups, products, onPick, onClose }: PaletteListProps) {
  const base = useId();
  const options = groups.flatMap((g) => g.items);
  const [pinned, setPinned] = useState<string | null>(null);
  const [moved, setMoved] = useState(false);
  const active = resolveActive(pinned, moved, options, products.state === "loading");
  // Adjusting state while rendering is the pattern React documents for following changed data.
  if (active !== pinned) setPinned(active);
  const activeIndex = options.findIndex((o) => o.id === active);
  // From the item, not its position: a different item at the same position is a different descendant.
  const optionId = (item: PaletteItem) => `${base}-option-${encodeURIComponent(item.id)}`;

  useEffect(() => {
    if (activeIndex >= 0) document.getElementById(optionId(options[activeIndex]))?.scrollIntoView?.({ block: "nearest" });
    // optionId and options are rebuilt every render; the highlighted row (by id) is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, active]);

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
    // Safari reports the Enter that confirms a candidate as keyCode 229 with isComposing already false.
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
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
          aria-activedescendant={activeIndex >= 0 ? optionId(options[activeIndex]) : undefined}
          aria-autocomplete="list"
          value={query}
          onChange={(event) => {
            onQueryChange(event.target.value);
            setPinned(null);
            setMoved(false);
          }}
          onKeyDown={onKeyDown}
          placeholder="Find a product, zone or page"
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
          {groups.map((g) => (
            <div key={g.key} role="group" aria-labelledby={`${base}-${g.key}`}>
              <div id={`${base}-${g.key}`} role="presentation" className="px-3 pt-2 pb-1 text-xs font-medium text-ink-muted">
                {g.heading}
              </div>
              {g.items.map((item) => (
                <PaletteRow
                  key={item.id}
                  item={item}
                  id={optionId(item)}
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
        {/* Status, not options: outside the listbox, after what is already there (products are appended last). */}
        {products.searching ? <p className="px-3 py-2 text-sm text-ink-muted">Searching products…</p> : null}
        {products.state === "error" ? <p className="px-3 py-2 text-sm text-ink-muted">Couldn&rsquo;t search products. Check your connection.</p> : null}
      </div>
      <p className="hidden border-t border-line-subtle px-4 py-2 text-xs text-ink-muted lg:block">↑ ↓ to move · Enter to open · Esc to close</p>
      <p role="status" aria-live="polite" className="sr-only">
        {spoken}
      </p>
    </>
  );
}
