// The placement form's state and its saving (0.7.0.5 spec §2.4). A select saves
// when it changes, a text field 600 ms after typing stops or on blur, and what
// is waiting is sent when the panel closes or another tile is picked (the
// callback is the one this form was given, so it saves into its own placement).
// An invalid value stays in its field with the rule's message and nothing is
// sent. One wait is one save, which is one Undo step.
//
// The placement coming back as a prop re-fills the fields only when it is not
// something this form loaded or sent: its own saves landing mid-typing must
// not undo the typing, while another device's change must show.

"use client";

import { useEffect, useRef, useState } from "react";

import { feetText } from "@/lib/feet";
import type { Neighbour } from "@/lib/planograms/rules";
import type { PlacementFields, PlanogramFace } from "@/lib/planograms/types";
import type { Footprint, Presentation } from "@/lib/products/footprint";

import { readValues, signature, valuesOf, type FormValues } from "./placement-values";
import type { CommitResult } from "./use-builder";
import { useAutoSave } from "./use-auto-save";
import type { DraftStatus } from "./use-planogram-draft";

export const LOST_CONNECTION = "Couldn't save. Check the connection and try again.";

export type PlacementEditorOptions = {
  faces: readonly PlanogramFace[];
  initial: PlacementFields;
  others: readonly Neighbour[];
  excludeId: string | null;
  /** When adding: switching presentation re-fills the size from the product's footprint. */
  footprints?: Record<Presentation, Footprint>;
  onSubmit: (fields: PlacementFields) => Promise<CommitResult>;
};

/** What this form has loaded or sent (`known`), and what it last sent (`held`, which a repeat of is no change). */
type Track = { known: readonly string[]; held: string };

export function usePlacementEditor({ faces, initial, others, excludeId, footprints, onSubmit }: PlacementEditorOptions) {
  const [values, setValues] = useState(() => valuesOf(initial, faces));
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<DraftStatus>({ kind: "idle" });
  const [track, setTrack] = useState<Track>(() => ({ known: [signature(initial)], held: signature(initial) }));
  // The same, for the timer and the blur, which run between renders.
  const trackRef = useRef(track);
  useEffect(() => {
    trackRef.current = track;
  });
  function keep(next: Track) {
    trackRef.current = next;
    setTrack(next);
  }

  // Not one of ours: another device changed it (or the server kept something else), so show it. Adjusted during render, as React allows for own state.
  const incoming = signature(initial);
  if (!track.known.includes(incoming)) {
    setTrack({ known: [incoming], held: incoming });
    setValues(valuesOf(initial, faces));
    setError(null);
  } else if (track.known.length > 1 && incoming === track.held) {
    // The last thing sent has come back: from here on, going back to anything older (an Undo) is a change to show.
    setTrack({ known: [incoming], held: incoming });
  }

  async function commit(typed: FormValues) {
    const read = readValues(typed, initial.faceId, faces, others, excludeId);
    if ("error" in read) return setError(read.error);
    setError(null);
    const sent = signature(read.fields);
    const { known, held } = trackRef.current;
    if (sent === held) return;
    keep({ known: known.includes(sent) ? known : [...known, sent], held: sent });
    setStatus({ kind: "saving" });
    const result = await onSubmit(read.fields);
    if (result.ok) return setStatus({ kind: "saved" });
    // Nothing was saved: the same edit may be sent again.
    if (trackRef.current.held === sent) keep({ ...trackRef.current, held });
    const message = result.message ?? LOST_CONNECTION;
    setError(message);
    setStatus({ kind: "refused", message });
  }

  const auto = useAutoSave(commit);

  function edit(key: Exclude<keyof FormValues, "presentation">, text: string) {
    const next = { ...values, [key]: text };
    setValues(next);
    auto.later(next);
  }

  function choosePresentation(presentation: Presentation) {
    const next = { ...values, presentation, ...(footprints ? { width: feetText(footprints[presentation].columns), rowSpan: String(footprints[presentation].rows) } : {}) };
    setValues(next);
    auto.now(next);
  }

  return { values, error, status, edit, choosePresentation, flush: auto.flush };
}
