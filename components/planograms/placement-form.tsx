// One placement's numbers (spec §4 "Edit numbers"): face, feet from the left
// and width in half steps, then levels (or, on a table top, feet from the back
// and depth), presentation and pieces. The numbers are as a person reads them,
// so a back or right lower table counts from its outer edge (readCells). Checked here with the server's own rules
// so a refusal names its reason before anything is sent; the server checks again.

"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FIELD_CLASSES } from "@/components/ui/password-field";
import { feetText, parseFeet } from "@/lib/feet";
import { checkPlacement, type Neighbour } from "@/lib/planograms/rules";
import type { PlacementFields, PlanogramFace } from "@/lib/planograms/types";
import { PRESENTATION_LABEL, PRESENTATIONS, type Footprint, type Presentation } from "@/lib/products/footprint";
import { readCells, type Cells } from "@/lib/products/location-words";
import { InfoPopover } from "@/components/ui/info-popover";

type PlacementFormProps = {
  faces: readonly PlanogramFace[];
  initial: PlacementFields;
  others: readonly Neighbour[];
  excludeId: string | null;
  /** When adding: switching presentation re-fills the size from the product's footprint. */
  footprints?: Record<Presentation, Footprint>;
  submitLabel: string;
  busy: boolean;
  /** Resolves to the server's refusal, shown here beside the fields, or null. */
  onSubmit: (fields: PlacementFields) => Promise<string | null>;
  onRemove?: () => void;
};

const whole = (text: string) => (/^\d+$/.test(text.trim()) ? Number(text) : NaN);

export function PlacementForm({ faces, initial, others, excludeId, footprints, submitLabel, busy, onSubmit, onRemove }: PlacementFormProps) {
  const faceOf = (id: string) => faces.find((f) => f.faceId === id);
  const asRead = (cells: Cells, id: string) => {
    const f = faceOf(id);
    return f ? readCells(cells, f) : cells;
  };
  const shown = asRead(initial, initial.faceId);
  const [faceId, setFaceId] = useState(initial.faceId);
  const [fromLeft, setFromLeft] = useState(feetText(shown.col));
  const [width, setWidth] = useState(feetText(shown.colSpan));
  // A standing face counts levels from 1 at the top; a table top counts whole feet from the back.
  const isTopOf = (id: string) => faceOf(id)?.side === "top";
  const [rowStart, setRowStart] = useState(String(isTopOf(initial.faceId) ? shown.row : shown.row + 1));
  const [rowSpan, setRowSpan] = useState(String(shown.rowSpan));
  const [presentation, setPresentation] = useState<Presentation>(initial.presentation);
  const [pieces, setPieces] = useState(String(initial.pieceCount));
  const [error, setError] = useState<string | null>(null);
  const face = faces.find((f) => f.faceId === faceId);
  const isTop = face?.side === "top";
  // A frame rack's rail holds hung product only, one row high (frame racks spec §3).
  const isRailOf = (id: string) => faceOf(id)?.fixtureType === "frame_rack";
  const isRail = isRailOf(faceId);

  function choosePresentation(next: Presentation) {
    setPresentation(next);
    if (footprints) {
      setWidth(feetText(footprints[next].columns));
      setRowSpan(String(footprints[next].rows));
    }
  }

  function chooseFace(next: string) {
    // Keep the same place: level n is n - 1 ft from the back.
    const row = whole(rowStart);
    if (!Number.isNaN(row) && isTopOf(next) !== isTop) setRowStart(String(isTopOf(next) ? Math.max(0, row - 1) : row + 1));
    setFaceId(next);
    if (isRailOf(next)) {
      setPresentation("hung");
      if (footprints) setWidth(feetText(footprints.hung.columns));
      setRowStart("1");
      setRowSpan("1");
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const col = parseFeet(fromLeft);
    const colSpan = parseFeet(width);
    if (col === null || colSpan === null) return setError("Use feet in half steps, like 4 or 4½.");
    if (colSpan === 0) return setError("Width must be at least ½ ft.");
    const start = whole(rowStart);
    const read = { col, colSpan, row: isTop ? start : start - 1, rowSpan: whole(rowSpan) };
    const pieceCount = whole(pieces);
    const levelsOk = [read.row, read.rowSpan, pieceCount].every((n) => Number.isInteger(n) && n >= 0) && read.rowSpan >= 1 && pieceCount >= 1;
    if (!levelsOk) return setError(isTop ? "Use whole feet for from back and depth, and whole numbers for pieces." : "Use whole numbers from 1 for levels and pieces.");
    const onRail = isRail ? { row: 0, rowSpan: 1 } : {};
    const fields: PlacementFields = { faceId, presentation: isRail ? "hung" : presentation, pieceCount, ...asRead({ ...read, ...onRail }, faceId) };
    const refusal = checkPlacement({ ...fields, id: excludeId }, others, faces);
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
          <select value={faceId} onChange={(e) => chooseFace(e.target.value)} className={FIELD_CLASSES}>
            {faces.map((f) => (
              <option key={f.faceId} value={f.faceId}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <fieldset className="flex gap-4">
        <legend className="mb-1 text-sm text-ink">
          <span className="inline-flex items-center gap-1">
            Presentation
            <InfoPopover term="presentation" />
          </span>
        </legend>
        {PRESENTATIONS.map((p) => (
          <label key={p} className="flex min-h-11 items-center gap-2 text-ink has-disabled:opacity-60">
            <input type="radio" name="presentation" value={p} checked={(isRail ? "hung" : presentation) === p} disabled={isRail} onChange={() => choosePresentation(p)} className="size-5" />
            {PRESENTATION_LABEL[p]}
          </label>
        ))}
      </fieldset>
      {isRail ? <p className="-mt-2 text-sm text-ink-muted">Frame racks hold hung product only, on their one rail.</p> : null}
      <div className="grid grid-cols-2 gap-3">
        <Input label="From left (ft)" inputMode="decimal" value={fromLeft} onChange={(e) => setFromLeft(e.target.value)} hint="Half steps: 4 or 4½." />
        <Input label="Width (ft)" inputMode="decimal" value={width} onChange={(e) => setWidth(e.target.value)} />
        {isTop ? (
          <>
            <Input label="From back (ft)" inputMode="numeric" value={rowStart} onChange={(e) => setRowStart(e.target.value)} />
            <Input label="Depth (ft)" inputMode="numeric" value={rowSpan} onChange={(e) => setRowSpan(e.target.value)} />
          </>
        ) : (
          <>
            <Input label="Top level" inputMode="numeric" value={rowStart} onChange={(e) => setRowStart(e.target.value)} hint={face ? `1 is the top of ${face.rows}.` : undefined} />
            <Input label="Levels tall" inputMode="numeric" value={rowSpan} onChange={(e) => setRowSpan(e.target.value)} />
          </>
        )}
        <Input label="Pieces" info="pieces" inputMode="numeric" value={pieces} onChange={(e) => setPieces(e.target.value)} />
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
