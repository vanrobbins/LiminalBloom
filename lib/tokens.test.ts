// Tests for the color tokens in app/globals.css.
//
// The tokens are plain CSS, so nothing type-checks them. A token added to the
// light theme and forgotten in the dark one, or defined but never exposed to
// Tailwind, fails silently: the page renders, just in the wrong color, and
// usually only in one theme. These tests read the stylesheet as text and
// catch that before a browser has to.

import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const css = readFileSync("app/globals.css", "utf8");

const TOKENS = [
  "surface",
  "raised",
  "ink",
  "ink-muted",
  "line",
  "line-subtle",
  "brand",
  "brand-strong",
  "on-brand",
  "ok",
  "ok-tint",
  "danger",
  "danger-tint",
  "info",
  "info-tint",
  "scrim",
];

/** The custom properties declared inside the first block matching `selector`. */
function variablesIn(selector: RegExp): Map<string, string> {
  const block = css.match(selector)?.[1] ?? "";
  const variables = new Map<string, string>();

  for (const [, name, value] of block.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
    variables.set(name, value.trim());
  }

  return variables;
}

const light = variablesIn(/:root\s*\{([^}]*)\}/);
const dark = variablesIn(/\.dark\s*\{([^}]*)\}/);

/** Relative luminance (WCAG) of an opaque `oklch(L% C h)` color. */
function luminance(value: string): number {
  const match = value.match(/^oklch\(([\d.]+)%\s+([\d.]+)\s+([\d.]+)\)$/);
  if (!match) {
    throw new Error(`Not an opaque OKLCH color: ${value}`);
  }

  const lightness = Number(match[1]) / 100;
  const chroma = Number(match[2]);
  const hue = (Number(match[3]) * Math.PI) / 180;
  const a = chroma * Math.cos(hue);
  const b = chroma * Math.sin(hue);

  // OKLab -> linear sRGB (Björn Ottosson's published matrices).
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;

  const clamp = (x: number) => Math.min(1, Math.max(0, x));
  const red = clamp(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
  const green = clamp(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
  const blue = clamp(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(foreground: string, background: string): number {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort(
    (x, y) => y - x,
  );
  return (lighter + 0.05) / (darker + 0.05);
}

describe("color tokens", () => {
  it("defines every token in the light theme", () => {
    expect([...light.keys()].sort()).toEqual([...TOKENS].sort());
  });

  it("defines every token in the dark theme", () => {
    expect([...dark.keys()].sort()).toEqual([...TOKENS].sort());
  });

  it("writes every value in OKLCH", () => {
    for (const value of [...light.values(), ...dark.values()]) {
      expect(value).toMatch(/^oklch\(.+\)$/);
    }
  });

  it("exposes every token to Tailwind", () => {
    // Without this line the class, e.g. bg-line-subtle, generates nothing.
    for (const token of TOKENS) {
      expect(css).toContain(`--color-${token}: var(--${token});`);
    }
  });

  it("dims the page behind a sheet in both themes", () => {
    // Ink turns cream in dark mode, so a scrim made from it would lighten
    // the page instead of dimming it. The scrim stays dark in both.
    for (const theme of [light, dark]) {
      const lightness = Number(theme.get("scrim")?.match(/^oklch\(([\d.]+)%/)?.[1]);
      expect(lightness).toBeLessThan(30);
    }
  });

  it("declares the dark block after the light one", () => {
    // :root and .dark have equal specificity, so the later one wins. Written
    // the other way round, the dark theme would never apply.
    expect(css.indexOf(".dark {")).toBeGreaterThan(css.indexOf(":root {"));
  });
});

describe("status colors", () => {
  // Status text sits on its own tint (badges), on the page, and on cards.
  // WCAG AA for body text is 4.5:1, in both themes (§1.5).
  const TONES = ["ok", "danger", "info"];
  const BACKGROUNDS = (tone: string) => [`${tone}-tint`, "surface", "raised"];

  describe.each([
    ["light", light],
    ["dark", dark],
  ])("%s theme", (_name, theme) => {
    it.each(TONES)("%s text meets 4.5:1 on its tint, the page and cards", (tone) => {
      for (const background of BACKGROUNDS(tone)) {
        expect(
          contrast(theme.get(tone)!, theme.get(background)!),
          `${tone} on ${background}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    });
  });
});

describe("app/ and components/ use tokens, not literal colors", () => {
  const files = ["app", "components"].flatMap((dir) =>
    readdirSync(dir, { recursive: true, encoding: "utf8" })
      .filter((file) => /\.(tsx|ts|css)$/.test(file))
      .map((file) => `${dir}/${file.replaceAll("\\", "/")}`),
  );

  it.each(files)("%s has no hex colors", (file) => {
    const source = readFileSync(file, "utf8");
    // Six-digit hex, or a Tailwind arbitrary color like bg-[#…]. HTML entities
    // such as &#10052; have five digits and a leading &, so do not match.
    expect(source).not.toMatch(/(?<!&)#[0-9A-Fa-f]{6}\b|\[#/);
  });

  it.each(files)("%s has no Tailwind palette colors", (file) => {
    // text-red-700 and friends bypass the tokens, so they skip dark mode
    // and the contrast checks above.
    const source = readFileSync(file, "utf8");
    expect(source).not.toMatch(
      /\b(?:bg|text|border|outline|ring|fill|stroke)-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-\d{2,3}\b/,
    );
  });
});
