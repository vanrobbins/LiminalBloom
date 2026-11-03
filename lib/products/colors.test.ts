import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { COLOR_WORDS, colorWordTint, contrastRatio, detailOf, hexToOklch, oklchToHex, tintFor, type Oklch } from "./colors";

describe("colour words", () => {
  it("takes the last colour word in a name", () => {
    expect(colorWordTint("Washed Black")).toEqual(COLOR_WORDS.black);
    expect(colorWordTint("Navy Blue")).toEqual(COLOR_WORDS.blue);
    expect(colorWordTint("NAVY")).toEqual(COLOR_WORDS.navy);
  });

  it("lifts heather and light, and drops dark", () => {
    expect(colorWordTint("Heather Grey")?.l).toBeCloseTo(COLOR_WORDS.grey.l + 0.12);
    expect(colorWordTint("Light Blue")?.l).toBeCloseTo(COLOR_WORDS.blue.l + 0.12);
    expect(colorWordTint("Dark Olive")?.l).toBeCloseTo(COLOR_WORDS.olive.l - 0.12);
  });

  it("leaves an unknown word neutral", () => {
    expect(colorWordTint("Sunset Glow")).toBeNull();
    expect(tintFor(null, "Sunset Glow")).toBeNull();
  });

  it("prefers the swatch to the colour word", () => {
    expect(tintFor("#1f3a5c", "Red")).toEqual(hexToOklch("#1f3a5c"));
    expect(tintFor(null, "Red")).toEqual(COLOR_WORDS.red);
  });
});

describe("OKLCH", () => {
  it("round-trips sRGB hex", () => {
    for (const hex of ["#000000", "#ffffff", "#1f3a5c", "#7a2e3b", "#c8b48a"]) expect(oklchToHex(hexToOklch(hex))).toBe(hex);
  });

  it("darkens details by 0.15, or lightens them on a fill darker than 0.35", () => {
    expect(detailOf({ l: 0.6, c: 0.1, h: 40 }).l).toBeCloseTo(0.45);
    expect(detailOf(COLOR_WORDS.black).l).toBeCloseTo(COLOR_WORDS.black.l + 0.15);
    expect(detailOf({ l: 0.35, c: 0, h: 0 }).l).toBeCloseTo(0.2);
  });
});

// The outline is ink-muted (70% ink over the background). WCAG 1.4.11 asks 3:1
// for graphics against what they sit on: the surface and raised tokens.
describe("the drawing outline", () => {
  const css = readFileSync("app/globals.css", "utf8");
  const token = (block: string, name: string) => {
    const scope = css.slice(css.indexOf(block));
    const m = scope.match(new RegExp(`--${name}: oklch\\(([\\d.]+)% ([\\d.]+) ([\\d.]+)(?: / ([\\d.]+))?\\)`))!;
    return { color: { l: Number(m[1]) / 100, c: Number(m[2]), h: Number(m[3]) } as Oklch, alpha: m[4] ? Number(m[4]) : 1 };
  };
  const over = (fg: Oklch, alpha: number, bg: Oklch): Oklch => {
    const [f, b] = [oklchToHex(fg), oklchToHex(bg)].map((hex) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)));
    const mixed = f.map((v, i) => Math.round(alpha * v + (1 - alpha) * b[i]));
    return hexToOklch(`#${mixed.map((v) => v.toString(16).padStart(2, "0")).join("")}`);
  };

  for (const block of [":root {", ".dark {"]) {
    for (const surface of ["surface", "raised"]) {
      it(`is at least 3:1 against ${surface} in ${block === ":root {" ? "light" : "dark"}`, () => {
        const ink = token(block, "ink-muted");
        const bg = token(block, surface).color;
        expect(contrastRatio(over(ink.color, ink.alpha, bg), bg)).toBeGreaterThanOrEqual(3);
      });
    }
  }
});
