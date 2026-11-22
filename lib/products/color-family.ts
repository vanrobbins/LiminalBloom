// A product's colour family, for Quick Adjust's suggestions (0.7.0.9 spec §4.3): "neutral" for
// the low-chroma colours, else the name of its hue. It works from the swatch if there is one,
// else from the colour word, the same two sources the drawing is tinted from (colors.ts).

import { colorWordTint, hexToOklch, type Oklch } from "./colors";

/** The eight names a hue falls into, each at its centre in degrees. */
const HUE_NAMES: [number, string][] = [
  [25, "red"], [55, "orange"], [95, "yellow"], [145, "green"], [195, "teal"], [255, "blue"], [305, "purple"], [350, "pink"],
];

/** At or under this chroma a colour reads as black, white, grey, cream: neutral at any hue (cream is 0.04). */
export const NEUTRAL_CHROMA = 0.04;

export function hueName(h: number): string {
  const distance = (a: number) => Math.min(Math.abs(a - h), 360 - Math.abs(a - h));
  return HUE_NAMES.reduce((best, next) => (distance(next[0]) < distance(best[0]) ? next : best))[1];
}

const SWATCH = /^#[0-9a-f]{6}$/i;

/** The family of a colour, or null for a word it does not know (it matches nothing). */
export function colorFamily(color: string, swatch?: string | null): string | null {
  const tint: Oklch | null = swatch && SWATCH.test(swatch) ? hexToOklch(swatch) : colorWordTint(color);
  if (!tint) return null;
  return tint.c <= NEUTRAL_CHROMA ? "neutral" : hueName(tint.h);
}
