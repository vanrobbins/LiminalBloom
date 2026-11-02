// How a place is written (§3.2, DECISIONS 10-12): the fixture, its side when
// it has more than one, then the place in words (location-words.ts); a second
// line gives feet and levels. Two people describe the same spot the same way.

import { SIDE_LABEL } from "@/lib/layout/format";

import { feetLine, placeWords, type Spot } from "./location-words";

export type { Cells } from "./location-words";

export type LocationParts = ({ kind: "floor"; fixtureName: string; faceCount: number } & Spot) | { kind: "bin"; code: string };

export function locationLabel(parts: LocationParts): string {
  if (parts.kind === "bin") return `Stockroom, bin ${parts.code}`;
  const side = parts.faceCount > 1 ? SIDE_LABEL[parts.side] : null;
  return [parts.fixtureName, side, placeWords(parts) || null].filter(Boolean).join(" · ");
}

export function locationDetail(parts: LocationParts): string {
  return parts.kind === "bin" ? "" : feetLine(parts);
}
