// How a place is written (§3.2): a fixture plus a cell, so two people can never
// describe the same spot differently. Columns are letters, rows are numbers,
// and the side is named only when the fixture has more than one.

import { SIDE_LABEL } from "@/lib/layout/format";
import type { FaceSide } from "@/lib/layout/types";

export type Cells = { col: number; row: number; colSpan: number; rowSpan: number };

export type LocationParts =
  | { kind: "floor"; fixtureName: string; side: FaceSide; faceCount: number; cells: Cells }
  | { kind: "bin"; code: string };

export function columnLetters(index: number): string {
  let n = index + 1;
  let letters = "";
  while (n > 0) {
    const rest = (n - 1) % 26;
    letters = String.fromCharCode(65 + rest) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

export function cellLabel(col: number, row: number): string {
  return `${columnLetters(col)}${row + 1}`;
}

export function spanLabel(c: Cells): string {
  const first = cellLabel(c.col, c.row);
  if (c.colSpan === 1 && c.rowSpan === 1) return first;
  return `${first}–${cellLabel(c.col + c.colSpan - 1, c.row + c.rowSpan - 1)}`;
}

export function locationLabel(parts: LocationParts, options: { span?: boolean } = {}): string {
  if (parts.kind === "bin") return `Stockroom, bin ${parts.code}`;
  const cell = options.span ? spanLabel(parts.cells) : cellLabel(parts.cells.col, parts.cells.row);
  const side = parts.faceCount > 1 ? `${SIDE_LABEL[parts.side]}, ` : "";
  return `${parts.fixtureName}, ${side}${cell}`;
}
