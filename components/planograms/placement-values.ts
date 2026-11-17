// The placement form's text as numbers and back (spec §4 "Edit numbers"). The
// numbers are as a person reads them, so a back or right lower table counts
// from its outer edge (readCells). Checked here with the server's own rules so
// a refusal names its reason before anything is sent; the server checks again.

import { feetText, parseFeet } from "@/lib/feet";
import { checkPlacement, type Neighbour } from "@/lib/planograms/rules";
import type { PlacementFields, PlanogramFace } from "@/lib/planograms/types";
import type { Presentation } from "@/lib/products/footprint";
import { readCells, type Cells } from "@/lib/products/location-words";

export type FormValues = { fromLeft: string; width: string; rowStart: string; rowSpan: string; pieces: string; presentation: Presentation };

/** The number fields, which an error can be about (presentation is a choice, never invalid). */
export type NumberKey = Exclude<keyof FormValues, "presentation">;
/** Why it can't be sent, and which fields it is about (the form ties the message to them). */
/** `heard`: the draft's status line already said it (a refusal from the server), so the form shows it without a second announcement. */
export type FieldError = { message: string; fields: readonly NumberKey[]; heard?: true };
const POSITION: readonly NumberKey[] = ["fromLeft", "width", "rowStart", "rowSpan"];
export const ALL_NUMBERS: readonly NumberKey[] = [...POSITION, "pieces"];

const whole = (text: string) => (/^\d+$/.test(text.trim()) ? Number(text) : NaN);
const faceOf = (faces: readonly PlanogramFace[], id: string) => faces.find((f) => f.faceId === id);
// A frame rack's rail holds hung product only, one row high (frame racks spec §3).
export const isRailFace = (face: PlanogramFace | undefined) => face?.fixtureType === "frame_rack";

/** Stored cells as read, or as stored: `readCells` is its own inverse. */
const asRead = (cells: Cells, face: PlanogramFace | undefined) => (face ? readCells(cells, face) : cells);

/** The fields as the form shows them. A standing face counts levels from 1 at the top; a table top counts whole feet from the back. */
export function valuesOf(fields: PlacementFields, faces: readonly PlanogramFace[]): FormValues {
  const face = faceOf(faces, fields.faceId);
  const shown = asRead(fields, face);
  return {
    fromLeft: feetText(shown.col),
    width: feetText(shown.colSpan),
    rowStart: String(face?.side === "top" ? shown.row : shown.row + 1),
    rowSpan: String(shown.rowSpan),
    pieces: String(fields.pieceCount),
    presentation: fields.presentation,
  };
}

/** What the form says, as fields to send, or why it can't be sent yet. */
export function readValues(values: FormValues, faceId: string, faces: readonly PlanogramFace[], others: readonly Neighbour[], excludeId: string | null): { fields: PlacementFields } | { error: string; fields: readonly NumberKey[] } {
  const face = faceOf(faces, faceId);
  const isTop = face?.side === "top";
  const isRail = isRailFace(face);
  const col = parseFeet(values.fromLeft);
  const colSpan = parseFeet(values.width);
  if (col === null || colSpan === null) return { error: "Use feet in half steps, like 4 or 4½.", fields: [...(col === null ? (["fromLeft"] as const) : []), ...(colSpan === null ? (["width"] as const) : [])] };
  if (colSpan === 0) return { error: "Width must be at least ½ ft.", fields: ["width"] };
  const start = whole(values.rowStart);
  const read = { col, colSpan, row: isTop ? start : start - 1, rowSpan: whole(values.rowSpan) };
  const pieceCount = whole(values.pieces);
  const bad: NumberKey[] = [];
  if (!(Number.isInteger(read.row) && read.row >= 0)) bad.push("rowStart");
  if (!(Number.isInteger(read.rowSpan) && read.rowSpan >= 1)) bad.push("rowSpan");
  if (!(Number.isInteger(pieceCount) && pieceCount >= 1)) bad.push("pieces");
  if (bad.length) return { error: isTop ? "Use whole feet for from back and depth, and whole numbers for pieces." : "Use whole numbers from 1 for levels and pieces.", fields: bad };
  const onRail = isRail ? { row: 0, rowSpan: 1 } : {};
  const fields: PlacementFields = { faceId, presentation: isRail ? "hung" : values.presentation, pieceCount, ...asRead({ ...read, ...onRail }, face) };
  const refusal = checkPlacement({ ...fields, id: excludeId }, others, faces);
  if (!refusal) return { fields };
  // The reason names a kind: pieces, where it sits, or something about the whole placement.
  return { error: refusal.message, fields: refusal.kind === "pieces" ? ["pieces"] : refusal.kind === "off-edge" || refusal.kind === "overlap" ? POSITION : ALL_NUMBERS };
}

/** The fields that make a placement what it is, as text: two with the same one are the same save. */
export const signature = (f: PlacementFields) => [f.faceId, f.presentation, f.pieceCount, f.col, f.row, f.colSpan, f.rowSpan].join("|");
