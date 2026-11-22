// The Adjust panel (0.7.0.9 spec §5.1): the product panel's container (a bottom sheet on a phone, a panel beside the grid
// from 768 px, not modal) holding the target's own details, its status, "Replace with", Search below the group, and the
// panel's save line. Suggestions are read from the server for the tile and again whenever the draft moves (another tile's
// change can free or take the cells), keeping the last list on screen meanwhile.

"use client";

import { Search } from "lucide-react";
import { useEffect, useState } from "react";

import { suggestionsForAction } from "@/app/(app)/planograms/adjust-actions";
import { PanelSaveLine } from "@/components/planograms/panel-save-line";
import { ProductSheet } from "@/components/planograms/product-sheet";
import type { GridItem } from "@/components/planograms/grid-items";
import type { DraftStatus } from "@/components/planograms/use-planogram-draft";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import type { SuggestionView } from "@/lib/planograms/adjust-reads";
import type { PlanogramFace, SnapshotEntry } from "@/lib/planograms/types";

import { ReplaceChoices, type Chosen } from "./replace-choices";
import { refOf, type Choice } from "./use-adjustment";

type AdjustPanelProps = {
  fixtureId: string;
  open: boolean;
  /** The tile as the version has it (the original product, whatever a change draws there). */
  original: GridItem | null;
  entry: SnapshotEntry | null;
  face: PlanogramFace | null;
  current: Choice;
  chosen: Chosen | null;
  /** The draft's version: a change anywhere may free or take cells, so the suggestions are read again. */
  draftVersion: number;
  status: DraftStatus;
  onChoose: (choice: Choice) => void;
  onSearch: () => void;
  onClose: () => void;
};

/** The ranked suggestions for a tile; null until the first read for it. */
function useSuggestions(fixtureId: string, entry: SnapshotEntry | null, draftVersion: number) {
  const key = entry ? [entry.faceId, entry.col, entry.row, entry.depth ?? 0, entry.productId].join("|") : null;
  const [read, setRead] = useState<{ key: string; list: SuggestionView[] } | null>(null);
  useEffect(() => {
    if (!entry || !key) return;
    let live = true;
    suggestionsForAction(fixtureId, refOf(entry))
      .then((list) => live && setRead({ key, list }))
      .catch(() => live && setRead({ key, list: [] }));
    return () => {
      live = false;
    };
    // A new tile or a moved draft reads again; the entry itself is the version's and doesn't change under the key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixtureId, key, draftVersion]);
  return read && read.key === key ? read.list : null;
}

export function AdjustPanel({ fixtureId, open, original, entry, face, current, chosen, draftVersion, status, onChoose, onSearch, onClose }: AdjustPanelProps) {
  const suggestions = useSuggestions(fixtureId, open ? entry : null, draftVersion);
  return (
    <ProductSheet open={open} item={original} face={face} onClose={onClose}>
      {original && open ? (
        <div data-adjust-panel className="flex flex-col gap-4">
          {original.status ? <StatusBadge status={original.status} /> : null}
          <ReplaceChoices
            original={{ name: original.productName, statusWord: original.status === "sold_out" ? "Sold out" : original.status === "on_sale" ? "On sale" : null }}
            suggestions={suggestions}
            chosen={chosen}
            current={current}
            onChoose={onChoose}
          />
          <Button variant="secondary" icon className="self-start" aria-label="Find another product" onClick={onSearch}>
            <Search aria-hidden="true" strokeWidth={1.75} className="size-5" />
          </Button>
          <PanelSaveLine status={status} />
        </div>
      ) : null}
    </ProductSheet>
  );
}
