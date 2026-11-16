// One placement's numbers (spec §4 "Edit numbers"): feet from the left and
// width in half steps, then levels (or, on a table top, feet from the back and
// depth), presentation and pieces. They save as they are changed (0.7.0.5): see
// use-placement-editor.ts. Which face it is on is the panel's face picker.

"use client";

import { useId } from "react";

import { InfoPopover } from "@/components/ui/info-popover";
import { Input } from "@/components/ui/input";
import { PRESENTATION_LABEL, PRESENTATIONS } from "@/lib/products/footprint";

import { isRailFace, type NumberKey } from "./placement-values";
import { PanelSaveLine } from "./panel-save-line";
import { usePlacementEditor, type PlacementEditorOptions } from "./use-placement-editor";

export function PlacementForm(props: PlacementEditorOptions) {
  const { values, error, status, edit, choosePresentation, flush } = usePlacementEditor(props);
  const face = props.faces.find((f) => f.faceId === props.initial.faceId);
  const isTop = face?.side === "top";
  const isRail = isRailFace(face);
  // The message is one paragraph for the form: the fields it is about point to it.
  const alertId = useId();
  const about = (key: NumberKey) => (error?.fields.includes(key) ? { "aria-invalid": true as const, "aria-describedby": alertId } : {});

  return (
    // Leaving a field sends what is waiting; Enter does the same. Moving to a presentation radio does not: the choice
    // sends the typing with it, so one gesture is one save and one Undo step.
    <form
      onBlur={(event) => {
        const to = event.relatedTarget;
        if (to instanceof HTMLInputElement && to.type === "radio" && event.currentTarget.contains(to)) return;
        flush();
      }}
      onSubmit={(event) => {
        event.preventDefault();
        flush();
      }}
      className="flex flex-col gap-4"
    >
      <fieldset className="flex gap-4">
        <legend className="mb-1 text-sm text-ink">
          <span className="inline-flex items-center gap-1">
            Presentation
            <InfoPopover term="presentation" />
          </span>
        </legend>
        {PRESENTATIONS.map((p) => (
          <label key={p} className="flex min-h-11 items-center gap-2 text-ink has-disabled:opacity-60">
            <input type="radio" name="presentation" value={p} checked={(isRail ? "hung" : values.presentation) === p} disabled={isRail} onChange={() => choosePresentation(p)} className="size-5" />
            {PRESENTATION_LABEL[p]}
          </label>
        ))}
      </fieldset>
      {isRail ? <p className="-mt-2 text-sm text-ink-muted">Frame racks hold hung product only, on their one rail.</p> : null}
      <div className="grid grid-cols-2 gap-3">
        <Input label="From left (ft)" data-first-field inputMode="decimal" value={values.fromLeft} onChange={(e) => edit("fromLeft", e.target.value)} {...about("fromLeft")} hint="Half steps: 4 or 4½." />
        <Input label="Width (ft)" inputMode="decimal" value={values.width} onChange={(e) => edit("width", e.target.value)} {...about("width")} />
        {isTop ? (
          <>
            <Input label="From back (ft)" inputMode="numeric" value={values.rowStart} onChange={(e) => edit("rowStart", e.target.value)} {...about("rowStart")} />
            <Input label="Depth (ft)" inputMode="numeric" value={values.rowSpan} onChange={(e) => edit("rowSpan", e.target.value)} {...about("rowSpan")} />
          </>
        ) : (
          <>
            <Input label="Top level" inputMode="numeric" value={values.rowStart} onChange={(e) => edit("rowStart", e.target.value)} {...about("rowStart")} hint={face ? `1 is the top of ${face.rows}.` : undefined} />
            <Input label="Levels tall" inputMode="numeric" value={values.rowSpan} onChange={(e) => edit("rowSpan", e.target.value)} {...about("rowSpan")} />
          </>
        )}
        <Input label="Pieces" info="pieces" inputMode="numeric" value={values.pieces} onChange={(e) => edit("pieces", e.target.value)} {...about("pieces")} />
      </div>
      {error ? (
        <p id={alertId} role="alert" className="text-sm text-danger">
          {error.message}
        </p>
      ) : null}
      <PanelSaveLine status={status} />
    </form>
  );
}
