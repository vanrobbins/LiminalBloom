// The placement form's state and its saving (0.7.0.5 spec §2.4). A select saves
// when it changes, a text field 600 ms after typing stops or on blur, and what
// is waiting is sent when the panel closes or another tile is picked (the
// callback is the one this form was given, so it saves into its own placement).
// An invalid value stays in its field with the rule's message and nothing is
// sent; if the form has closed by then, the status line says so instead. One
// wait is one save, which is one Undo step.
//
// The placement coming back as a prop re-fills the fields only when it is not
// something this form loaded or sent: its own saves landing mid-typing must
// not undo the typing, while another device's change must show. The face
// picker's move is announced beforehand (expectMove): its landing shows the new
// spot and keeps the pieces typed meanwhile.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { feetText } from "@/lib/feet";
import type { Neighbour } from "@/lib/planograms/rules";
import type { PlacementFields, PlanogramFace } from "@/lib/planograms/types";
import type { Footprint, Presentation } from "@/lib/products/footprint";

import { ALL_NUMBERS, readValues, signature, valuesOf, type FieldError, type FormValues } from "./placement-values";
import type { CommitResult } from "./use-builder";
import { useAutoSave } from "./use-auto-save";
import type { DraftStatus } from "./use-planogram-draft";

export const LOST_CONNECTION = "Couldn't save. Check the connection and try again.";
export const GONE = "This draft was published or discarded on another device.";

const OWN_MOVE = "placement:own-move";
/** The face picker says where a move will leave a placement, before it is sent, so its landing is not taken for another device's change. */
export function expectMove(id: string, fields: PlacementFields) {
  document.dispatchEvent(new CustomEvent(OWN_MOVE, { detail: { id, sig: signature(fields) } }));
}

export type PlacementEditorOptions = {
  faces: readonly PlanogramFace[];
  initial: PlacementFields;
  others: readonly Neighbour[];
  excludeId: string | null;
  /** When adding: switching presentation re-fills the size from the product's footprint. */
  footprints?: Record<Presentation, Footprint>;
  onSubmit: (fields: PlacementFields) => Promise<CommitResult>;
  /** What to say when the form is closed holding a value that is not valid: its own message has gone with it. */
  onInvalid?: (message: string) => void;
};

/** What this form has loaded or sent (`known`), what it last sent (`held`, which a repeat of is no change), and moves it expects. */
type Track = { known: readonly string[]; held: string; moves: readonly string[] };

export function usePlacementEditor({ faces, initial, others, excludeId, footprints, onSubmit, onInvalid }: PlacementEditorOptions) {
  const [values, setValues] = useState(() => valuesOf(initial, faces));
  const [error, setError] = useState<FieldError | null>(null);
  const [status, setStatus] = useState<DraftStatus>({ kind: "idle" });
  // Counts the re-fills, so what was waiting to be sent is dropped with the numbers it was typed over (or, for the
  // panel's own move, sent on as the numbers it left: `rebase`).
  const [refills, setRefills] = useState<{ count: number; rebase: FormValues | null }>({ count: 0, rebase: null });
  const [track, setTrack] = useState<Track>(() => ({ known: [signature(initial)], held: signature(initial), moves: [] }));
  // The same, for the timer and the blur, which run between renders.
  const trackRef = useRef(track);
  useEffect(() => {
    trackRef.current = track;
  });
  const keep = useCallback((next: Track) => {
    trackRef.current = next;
    setTrack(next);
  }, []);
  useEffect(() => {
    function onMove(event: Event) {
      const { id, sig } = (event as CustomEvent<{ id: string; sig: string }>).detail;
      if (id === excludeId) keep({ ...trackRef.current, moves: [...trackRef.current.moves, sig] });
    }
    document.addEventListener(OWN_MOVE, onMove);
    return () => document.removeEventListener(OWN_MOVE, onMove);
  }, [excludeId, keep]);
  // Whether the form is still on screen: unmount cleanups run in order, so this goes before the auto-save's closing flush.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Not one of ours: another device changed it (or the server kept something else), so show it. Adjusted during render, as React allows for own state.
  const incoming = signature(initial);
  if (!track.known.includes(incoming)) {
    // The panel's own move keeps the pieces typed since (what was typed over the position is replaced by the new spot).
    const shown = valuesOf(initial, faces);
    const own = track.moves.includes(incoming);
    const next = own ? { ...shown, pieces: values.pieces } : shown;
    setTrack({ known: [incoming], held: incoming, moves: [] });
    setValues(next);
    setError(null);
    setRefills({ count: refills.count + 1, rebase: own ? next : null });
  } else if (track.known.length > 1 && incoming === track.held) {
    // The last thing sent has come back: from here on, going back to anything older (an Undo) is a change to show.
    setTrack({ ...track, known: [incoming], held: incoming });
  }

  async function commit(typed: FormValues) {
    const read = readValues(typed, initial.faceId, faces, others, excludeId);
    if ("error" in read) {
      // Closed with this value in it: the form's own line has gone, so the status line tells them it was not saved.
      if (!mounted.current) return onInvalid?.(`Not saved. ${read.error}`);
      return setError({ message: read.error, fields: read.fields });
    }
    setError(null);
    const sent = signature(read.fields);
    const { known, held } = trackRef.current;
    if (sent === held) return;
    keep({ ...trackRef.current, known: known.includes(sent) ? known : [...known, sent], held: sent });
    setStatus({ kind: "saving" });
    const result = await onSubmit(read.fields);
    if (result.ok) return setStatus({ kind: "saved" });
    // Nothing was saved: the same edit may be sent again.
    if (trackRef.current.held === sent) keep({ ...trackRef.current, held });
    // Published or discarded elsewhere is not the connection (and the page reloads); a bare failure already toasted.
    const message = result.gone ? GONE : (result.message ?? LOST_CONNECTION);
    setError({ message, fields: result.gone ? [] : ALL_NUMBERS });
    setStatus({ kind: "refused", message });
  }

  const auto = useAutoSave(commit);
  const { cancel, rebase } = auto;
  // A re-fill from another device or an Undo replaced the numbers: a pause or blur must not send the old typing over it.
  useEffect(() => {
    if (refills.count === 0) return;
    if (refills.rebase) rebase(refills.rebase);
    else cancel();
  }, [refills, cancel, rebase]);

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
