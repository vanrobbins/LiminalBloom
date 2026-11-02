// How a place reads (spec §3, DECISIONS 10-12): the words a person uses in the
// store ("Left of center · Top rail"), then feet and levels for the exact spot.
// Cells stay the storage; nothing else turns them into words. "Left" is as you
// stand facing the face; a table top reads from its front, so its row 0 is the
// back. Bands are equal slices of the face; a placement takes the band holding
// its centre (a centre on an edge goes to the band after it).

import { COLUMNS_PER_FOOT, feetText } from "@/lib/feet";
import type { FaceSide, FixtureType } from "@/lib/layout/types";

import type { Presentation } from "./footprint";

export type Cells = { col: number; row: number; colSpan: number; rowSpan: number };

export type Spot = { fixtureType: FixtureType; side: FaceSide; columns: number; rows: number; presentation: Presentation; cells: Cells };

const WIDE = ["Far left", "Left", "Left of center", "Center", "Right of center", "Right", "Far right"];
const NARROW = ["Left", "Center", "Right"];
const LEVELS: Record<number, string[]> = { 2: ["Top", "Bottom"], 3: ["Top", "Middle", "Bottom"] };
const MANY_LEVELS = ["Top", "Upper", "Middle", "Lower", "Bottom"];
const DEPTHS: Record<number, string[]> = { 2: ["Back", "Front"], 3: ["Back", "Middle", "Front"] };
const MANY_DEPTHS = ["Back", "Near back", "Middle", "Near front", "Front"];
const NOUN: Partial<Record<FixtureType, Record<Presentation, string>>> = {
  wall_bay: { folded: "shelf", hung: "rail" },
  rack: { folded: "shelf", hung: "rail" },
};

/** Which of `count` equal bands of `total` holds `centre`. */
function band(centre: number, total: number, count: number): number {
  return Math.min(count - 1, Math.floor((centre / total) * count));
}

export function acrossWord(columns: number, cells: Cells): string | null {
  const feet = columns / COLUMNS_PER_FOOT;
  if (feet < 3) return null;
  if (cells.colSpan * 3 >= columns * 2) return "Full width";
  const words = feet >= 7 ? WIDE : NARROW;
  return words[band(cells.col + cells.colSpan / 2, columns, words.length)];
}

export function heightWord(spot: Spot): string | null {
  if (spot.rows <= 1) return null;
  const isTop = spot.side === "top";
  const words = isTop ? (DEPTHS[spot.rows] ?? MANY_DEPTHS) : (LEVELS[spot.rows] ?? MANY_LEVELS);
  const word = words[band(spot.cells.row + spot.cells.rowSpan / 2, spot.rows, words.length)];
  const noun = isTop ? undefined : NOUN[spot.fixtureType]?.[spot.presentation];
  return noun ? `${word} ${noun}` : word;
}

export function placeWords(spot: Spot): string {
  return [acrossWord(spot.columns, spot.cells), heightWord(spot)].filter(Boolean).join(" · ");
}

function feetAcross({ col, colSpan }: Cells): string {
  return colSpan === 1 ? `${feetText(col)}` : `${feetText(col)}–${feetText(col + colSpan)}`;
}

export function feetLine(spot: Spot): string {
  const { row, rowSpan } = spot.cells;
  const across = `${feetAcross(spot.cells)} ft from left`;
  if (spot.side === "top") return `${across} · ${row}–${row + rowSpan} ft from back`;
  const levels = rowSpan === 1 ? `level ${row + 1} of ${spot.rows}` : `levels ${row + 1}–${row + rowSpan} of ${spot.rows}`;
  return `${across} · ${levels}`;
}

export function spotSummary(spot: Spot): string {
  return placeWords(spot) || feetLine(spot);
}

/** The drag chip: feet across, then the level if there is one ("4–6 ft · Top shelf"). */
export function shortSpot(spot: Spot): string {
  const height = heightWord(spot);
  return height ? `${feetAcross(spot.cells)} ft · ${height}` : `${feetAcross(spot.cells)} ft`;
}
