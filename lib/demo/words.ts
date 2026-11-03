// Places in words and feet, as people say them on the floor:
// "Denim wall · Bottom shelf · 2–4 ft from left".

import { FIXTURES } from "./seed";
import type { Fixture, Placement } from "./types";

/** Half-foot columns as feet: 5 → "2½", 1 → "½", 4 → "2". */
export function feet(cols: number): string {
  const whole = Math.floor(cols / 2);
  const half = cols % 2 === 1 ? "½" : "";
  return whole === 0 && half ? half : `${whole}${half}`;
}

export function fixtureOf(id: string): Fixture {
  const fixture = FIXTURES.find((f) => f.id === id);
  if (!fixture) throw new Error(`No fixture ${id}`);
  return fixture;
}

export function faceOf(placement: Pick<Placement, "fixtureId" | "faceId">) {
  const face = fixtureOf(placement.fixtureId).faces.find((f) => f.id === placement.faceId);
  if (!face) throw new Error(`No face ${placement.faceId}`);
  return face;
}

/** The fixture, then the face when it has more than one, then the row. */
export function placeWords(placement: Placement): string {
  const fixture = fixtureOf(placement.fixtureId);
  const face = faceOf(placement);
  const side = fixture.faces.length > 1 ? ` · ${face.label}` : "";
  return `${fixture.name}${side} · ${face.rowWords[placement.row]}`;
}

export function spanWords(placement: Pick<Placement, "col" | "w">): string {
  return `${feet(placement.col)}–${feet(placement.col + placement.w)} ft from left`;
}

export function locationWords(placement: Placement): string {
  return `${placeWords(placement)} · ${spanWords(placement)}`;
}
