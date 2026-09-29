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

  it("declares the dark block after the light one", () => {
    // :root and .dark have equal specificity, so the later one wins. Written
    // the other way round, the dark theme would never apply.
    expect(css.indexOf(".dark {")).toBeGreaterThan(css.indexOf(":root {"));
  });
});

describe("app/ uses tokens, not literal colors", () => {
  const files = readdirSync("app", { recursive: true, encoding: "utf8" })
    .filter((file) => /\.(tsx|ts|css)$/.test(file))
    .map((file) => `app/${file.replaceAll("\\", "/")}`);

  it.each(files)("%s has no hex colors", (file) => {
    const source = readFileSync(file, "utf8");
    // Six-digit hex, or a Tailwind arbitrary color like bg-[#…]. HTML entities
    // such as &#10052; have five digits and a leading &, so do not match.
    expect(source).not.toMatch(/(?<!&)#[0-9A-Fa-f]{6}\b|\[#/);
  });
});
