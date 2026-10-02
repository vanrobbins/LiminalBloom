// Words and numbers as people read them: feet and inches, not raw inches
// (spec §4). Storage stays in inches.

import type { FaceSide, Layout, ZoneType } from "./types";

export function formatLength(inches: number): string {
  const total = Math.round(Math.abs(inches));
  const sign = total === 0 ? "" : inches < 0 ? "−" : "";
  const feet = Math.floor(total / 12);
  const rest = total % 12;
  if (feet === 0) return `${sign}${rest}″`;
  return rest === 0 ? `${sign}${feet}′` : `${sign}${feet}′ ${rest}″`;
}

export function formatArea(squareInches: number): string {
  return `${Math.round(squareInches / 144)} sq ft`;
}

export const ZONE_TYPE_LABEL: Record<ZoneType, string> = {
  display: "Display",
  fitting_room: "Fitting rooms",
  cash_wrap: "Cash wrap",
  stockroom: "Stockroom",
  other: "Other",
};

export const SIDE_LABEL: Record<FaceSide, string> = {
  front: "Front",
  back: "Back",
  left: "Left",
  right: "Right",
  top: "Top",
};

/** Entrances have no names; they are numbered in the order they were added. */
export function entranceLabel(layout: Layout, id: string): string {
  return `Entrance ${layout.entrances.findIndex((e) => e.id === id) + 1}`;
}
