import { describe, expect, it } from "vitest";

import { COLOR_WORDS, oklchToHex } from "./colors";
import { colorFamily, hueName, NEUTRAL_CHROMA } from "./color-family";

// Written out, not computed from the table, so a change to a colour word shows up here.
const WORDS: Record<string, string> = {
  black: "neutral", white: "neutral", ivory: "neutral", cream: "neutral", grey: "neutral", gray: "neutral", charcoal: "neutral", blush: "neutral",
  navy: "blue", blue: "blue", denim: "blue", indigo: "blue", sky: "blue",
  teal: "teal", green: "green", sage: "green",
  olive: "yellow", khaki: "yellow", mustard: "yellow", yellow: "yellow",
  tan: "orange", camel: "orange", brown: "orange", rust: "orange", orange: "orange",
  red: "red", burgundy: "red", pink: "pink", purple: "purple", lavender: "purple",
};

describe("colorFamily by colour word", () => {
  it("covers every colour word the app knows", () => {
    expect(Object.keys(WORDS).sort()).toEqual(Object.keys(COLOR_WORDS).sort());
  });

  it.each(Object.entries(WORDS))("%s is %s", (word, family) => {
    expect(colorFamily(word, null)).toBe(family);
  });

  it("reads the last colour word and its modifier, like the drawing does", () => {
    expect(colorFamily("Dark Navy", null)).toBe("blue");
    expect(colorFamily("Washed Black", null)).toBe("neutral");
    expect(colorFamily("Heather Grey", undefined)).toBe("neutral");
  });

  it("has no family for a word it does not know", () => {
    expect(colorFamily("Mauve-ish", null)).toBeNull();
    expect(colorFamily("", null)).toBeNull();
  });
});

describe("colorFamily by swatch", () => {
  it("the swatch wins over the word", () => {
    expect(colorFamily("Black", "#cc2222")).toBe("red");
    expect(colorFamily("Mauve-ish", "#1f3a5c")).toBe("blue");
  });

  it("a low-chroma swatch is neutral at any hue; just above the cut-off it has a hue", () => {
    expect(colorFamily("x", "#808080")).toBe("neutral");
    expect(colorFamily("x", oklchToHex({ l: 0.6, c: NEUTRAL_CHROMA - 0.015, h: 25 }))).toBe("neutral");
    expect(colorFamily("x", oklchToHex({ l: 0.6, c: NEUTRAL_CHROMA + 0.06, h: 25 }))).toBe("red");
  });

  it("a swatch that is not #rrggbb falls back to the word", () => {
    expect(colorFamily("Green", "teal")).toBe("green");
    expect(colorFamily("Green", "")).toBe("green");
  });
});

describe("hueName", () => {
  it("names a hue by the nearest of eight, wrapping round 0°", () => {
    expect([10, 30, 90, 150, 200, 250, 300, 355, 0].map(hueName)).toEqual(["red", "red", "yellow", "green", "teal", "blue", "purple", "pink", "pink"]);
  });
});
