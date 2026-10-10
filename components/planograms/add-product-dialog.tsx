// Add product (spec §5.3): find it with the library's search, then place it.
// The span starts from the product's footprint and the cell from the first
// open spot (or the cell that was tapped).

"use client";

import { useRef, useState } from "react";

import { pickerSearch } from "@/app/(app)/planograms/actions";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Neighbour } from "@/lib/planograms/rules";
import { MAX_PIECES, type PlacementFields, type PlanogramFace, type ProductFit } from "@/lib/planograms/types";
import { firstFreeSpot } from "@/lib/products/placement";

import { PlacementForm } from "./placement-form";
import { refusalOf, type SaveResult } from "./use-planogram-draft";

type AddProductDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  faces: readonly PlanogramFace[];
  startAt: { faceId: string; col: number; row: number } | null;
  others: readonly Neighbour[];
  busy: boolean;
  onAdd: (productId: string, fields: PlacementFields) => Promise<SaveResult>;
};

export function AddProductDialog({ open, onOpenChange, faces, startAt, others, busy, onAdd }: AddProductDialogProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductFit[]>([]);
  const [chosen, setChosen] = useState<ProductFit | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      setChosen(null);
      setQuery("");
      setResults([]);
    }
    onOpenChange(next);
  }

  function initialFor(product: ProductFit): PlacementFields {
    const faceId = startAt?.faceId ?? faces[0]?.faceId ?? "";
    const face = faces.find((f) => f.faceId === faceId);
    const size = product.footprints.folded;
    const spot =
      startAt ?? (face ? firstFreeSpot(face, others.filter((o) => o.faceId === faceId), size) : null) ?? { col: 0, row: 0 };
    return { faceId, presentation: "folded", col: spot.col, row: spot.row, colSpan: size.columns, rowSpan: size.rows, pieceCount: 1 };
  }

  return (
    <Dialog open={open} onOpenChange={close} title={chosen ? `Add ${chosen.name}` : "Add product"}>
      {chosen ? (
        <PlacementForm
          faces={faces}
          initial={initialFor(chosen)}
          others={others}
          excludeId={null}
          footprints={chosen.footprints}
          stackLimitFor={(p) => (p === "folded" ? chosen.footprints.folded.stackLimit : MAX_PIECES)}
          submitLabel="Add"
          busy={busy}
          onSubmit={async (fields) => {
            const result = await onAdd(chosen.id, fields);
            if (result.saved) close(false);
            return refusalOf(result);
          }}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <Input label="Find a product" type="search" value={query} onChange={(e) => search(e.target.value)} autoFocus />
          <ul className="flex max-h-72 flex-col overflow-y-auto">
            {results.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => setChosen(p)} className="flex min-h-11 w-full flex-col items-start border-b border-line-subtle py-2 text-left">
                  <span className="text-ink">{p.name}</span>
                  <span className="font-mono text-sm text-ink-muted">{p.styleNumber}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Dialog>
  );
}
