// One placement's fields (spec §5.3): face, cell, span, presentation, pieces.
// Checked here with the server's own rules so a refusal names its reason
// before anything is sent; the server checks again.

"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FIELD_CLASSES } from "@/components/ui/password-field";
import { parseCell } from "@/lib/planograms/cells";
import { checkPlacement, type Neighbour } from "@/lib/planograms/rules";
import type { PlacementFields, PlanogramFace } from "@/lib/planograms/types";
import { PRESENTATION_LABEL, PRESENTATIONS, type Footprint, type Presentation } from "@/lib/products/footprint";
import { cellLabel } from "@/lib/products/location-label";

type PlacementFormProps = {
  faces: readonly PlanogramFace[];
  initial: PlacementFields;
  others: readonly Neighbour[];
  excludeId: string | null;
  stackLimitFor: (presentation: Presentation) => number;
  /** When adding: switching presentation re-fills the span from the product's footprint. */
  footprints?: Record<Presentation, Footprint>;
  submitLabel: string;
  busy: boolean;
  /** Resolves to the server's refusal, shown here beside the fields, or null. */
  onSubmit: (fields: PlacementFields) => Promise<string | null>;
  onRemove?: () => void;
};

const whole = (text: string) => (/^\d+$/.test(text.trim()) ? Number(text) : NaN);

export function PlacementForm({ faces, initial, others, excludeId, stackLimitFor, footprints, submitLabel, busy, onSubmit, onRemove }: PlacementFormProps) {
  const [faceId, setFaceId] = useState(initial.faceId);
  const [cell, setCell] = useState(cellLabel(initial.col, initial.row));
  const [colSpan, setColSpan] = useState(String(initial.colSpan));
  const [rowSpan, setRowSpan] = useState(String(initial.rowSpan));
  const [presentation, setPresentation] = useState<Presentation>(initial.presentation);
  const [pieces, setPieces] = useState(String(initial.pieceCount));
  const [error, setError] = useState<string | null>(null);

  function choosePresentation(next: Presentation) {
    setPresentation(next);
    if (footprints) {
      setColSpan(String(footprints[next].columns));
      setRowSpan(String(footprints[next].rows));
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const at = parseCell(cell);
    if (!at) return setError("Type a cell like A4.");
    const fields: PlacementFields = { faceId, presentation, col: at.col, row: at.row, colSpan: whole(colSpan), rowSpan: whole(rowSpan), pieceCount: whole(pieces) };
    if ([fields.colSpan, fields.rowSpan, fields.pieceCount].some(Number.isNaN)) return setError("Use whole numbers for the size and pieces.");
    const refusal = checkPlacement({ ...fields, id: excludeId }, others, faces, stackLimitFor(presentation));
    if (refusal) return setError(refusal.message);
    setError(null);
    const refused = await onSubmit(fields);
    if (refused) setError(refused);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {faces.length > 1 ? (
        <label className="flex flex-col gap-1 text-sm text-ink">
          Side
          <select value={faceId} onChange={(e) => setFaceId(e.target.value)} className={FIELD_CLASSES}>
            {faces.map((f) => (
              <option key={f.faceId} value={f.faceId}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <fieldset className="flex gap-4">
        <legend className="mb-1 text-sm text-ink">Presentation</legend>
        {PRESENTATIONS.map((p) => (
          <label key={p} className="flex min-h-11 items-center gap-2 text-ink">
            <input type="radio" name="presentation" value={p} checked={presentation === p} onChange={() => choosePresentation(p)} className="size-5" />
            {PRESENTATION_LABEL[p]}
          </label>
        ))}
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Cell" value={cell} onChange={(e) => setCell(e.target.value)} autoCapitalize="characters" hint="Top-left cell, like A4." />
        <Input label="Pieces" inputMode="numeric" value={pieces} onChange={(e) => setPieces(e.target.value)} />
        <Input label="Columns wide" inputMode="numeric" value={colSpan} onChange={(e) => setColSpan(e.target.value)} />
        <Input label="Rows tall" inputMode="numeric" value={rowSpan} onChange={(e) => setRowSpan(e.target.value)} />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={busy} loadingText="Saving…">
          {submitLabel}
        </Button>
        {onRemove ? (
          <Button type="button" variant="secondary" onClick={onRemove} disabled={busy}>
            Remove
          </Button>
        ) : null}
      </div>
    </form>
  );
}
