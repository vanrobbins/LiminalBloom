// How a drawing is coloured (Week 6.5 spec §4.3): the product's own swatch,
// else its colour word, else neutral. Colours are worked in OKLCH, so "a bit
// darker" means the same thing for every hue.
//
// Details are the fill with lightness −0.15, or +0.15 when the fill is darker
// than 0.35 (black garments get lighter details). The rule is the same in both
// themes, so there is no per-theme detail token; a thin ink outline keeps any
// fill visible against the surface.

export type Oklch = { l: number; c: number; h: number };

/** Muted retail colour words. Lightness 0–1, chroma, hue in degrees. */
export const COLOR_WORDS: Record<string, Oklch> = {
  black: { l: 0.24, c: 0.005, h: 260 },
  white: { l: 0.97, c: 0.005, h: 90 },
  ivory: { l: 0.95, c: 0.03, h: 95 },
  cream: { l: 0.93, c: 0.04, h: 90 },
  grey: { l: 0.66, c: 0.005, h: 260 },
  gray: { l: 0.66, c: 0.005, h: 260 },
  charcoal: { l: 0.36, c: 0.008, h: 260 },
  navy: { l: 0.32, c: 0.07, h: 260 },
  blue: { l: 0.55, c: 0.11, h: 255 },
  denim: { l: 0.5, c: 0.08, h: 250 },
  indigo: { l: 0.38, c: 0.1, h: 270 },
  sky: { l: 0.78, c: 0.07, h: 235 },
  teal: { l: 0.55, c: 0.08, h: 195 },
  green: { l: 0.55, c: 0.1, h: 150 },
  olive: { l: 0.52, c: 0.08, h: 115 },
  sage: { l: 0.72, c: 0.05, h: 140 },
  khaki: { l: 0.74, c: 0.06, h: 90 },
  tan: { l: 0.72, c: 0.06, h: 70 },
  camel: { l: 0.66, c: 0.08, h: 65 },
  brown: { l: 0.45, c: 0.06, h: 55 },
  red: { l: 0.55, c: 0.16, h: 25 },
  burgundy: { l: 0.38, c: 0.1, h: 15 },
  rust: { l: 0.55, c: 0.12, h: 45 },
  orange: { l: 0.7, c: 0.14, h: 55 },
  mustard: { l: 0.74, c: 0.12, h: 90 },
  yellow: { l: 0.88, c: 0.12, h: 95 },
  pink: { l: 0.8, c: 0.08, h: 0 },
  blush: { l: 0.86, c: 0.04, h: 20 },
  purple: { l: 0.5, c: 0.11, h: 305 },
  lavender: { l: 0.8, c: 0.06, h: 300 },
};

const LIFT = 0.12;
const MODIFIERS: Record<string, number> = { heather: LIFT, light: LIFT, pale: LIFT, dark: -LIFT, deep: -LIFT };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** The last colour word in a name ("Washed Black" → black), lifted by "light"/"heather" or dropped by "dark" just before it. */
export function colorWordTint(word: string): Oklch | null {
  const words = word.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  for (let i = words.length - 1; i >= 0; i--) {
    const base = COLOR_WORDS[words[i]];
    if (!base) continue;
    const shift = MODIFIERS[words[i - 1] ?? ""] ?? 0;
    return { ...base, l: clamp(base.l + shift, 0.05, 0.98) };
  }
  return null;
}

// sRGB <-> OKLCH (Björn Ottosson's OKLab, https://bottosson.github.io/posts/oklab/).
const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const fromLinear = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

export function hexToOklch(hex: string): Oklch {
  const n = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => toLinear(v / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const h = (Math.atan2(B, A) * 180) / Math.PI;
  return { l: L, c: Math.hypot(A, B), h: h < 0 ? h + 360 : h };
}

/** Linear sRGB channels (may fall outside 0–1 for colours out of gamut). */
function oklchToLinear({ l: L, c, h }: Oklch): [number, number, number] {
  const A = c * Math.cos((h * Math.PI) / 180);
  const B = c * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

export function oklchToHex(color: Oklch): string {
  return `#${oklchToLinear(color)
    .map((v) => Math.round(clamp(fromLinear(clamp(v, 0, 1)), 0, 1) * 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

/** WCAG relative luminance. */
export function luminance(color: Oklch): number {
  const [r, g, b] = oklchToLinear(color).map((v) => clamp(v, 0, 1));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: Oklch, b: Oklch): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export const css = ({ l, c, h }: Oklch) => `oklch(${(l * 100).toFixed(1)}% ${c.toFixed(3)} ${h.toFixed(1)})`;

/** The detail tone for a fill: darker, or lighter on a very dark fill. */
export function detailOf(fill: Oklch): Oklch {
  return { ...fill, l: clamp(fill.l < 0.35 ? fill.l + 0.15 : fill.l - 0.15, 0, 1) };
}

/** The fill for a product: its swatch, else its colour word, else null (neutral tokens). */
export function tintFor(swatch: string | null | undefined, colorWord: string | null | undefined): Oklch | null {
  if (swatch && /^#[0-9a-f]{6}$/i.test(swatch)) return hexToOklch(swatch.toLowerCase());
  return colorWord ? colorWordTint(colorWord) : null;
}
