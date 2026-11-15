import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { SWITCHES, SWITCH_TEXT, type Switch, cleanSwitches, isSwitch, summaryLines } from "./switches";

describe("the switch list", () => {
  it("is the ten permissions, in order", () => {
    expect(SWITCHES).toEqual([
      "view",
      "products.stock",
      "products.sale",
      "planograms.draft",
      "planograms.publish",
      "layout.edit",
      "products.edit",
      "people.manage",
      "roles.manage",
      "store.settings",
    ]);
  });

  it("gives each one a toggle label and a summary phrase in plain words", () => {
    for (const key of SWITCHES) {
      const { label, can } = SWITCH_TEXT[key];
      expect(label.length).toBeGreaterThan(0);
      expect(can.length).toBeGreaterThan(0);
      // Users see "permissions"; the word "switch" is the code's name for them.
      expect(`${label} ${can}`).not.toMatch(/switch/i);
    }
    expect(SWITCH_TEXT["planograms.publish"].label).toBe("Publish planograms");
  });

  it("knows its own keys and nothing else", () => {
    expect(isSwitch("layout.edit")).toBe(true);
    expect(isSwitch("layout")).toBe(false);
    expect(isSwitch("View")).toBe(false);
    expect(isSwitch(7)).toBe(false);
    expect(isSwitch(null)).toBe(false);
  });
});

describe("cleanSwitches", () => {
  it("keeps known values, drops unknown and repeated ones, and always adds view", () => {
    const clean = cleanSwitches(["products.sale", "teleport", "products.sale", 3, null, "layout.edit"]);
    expect([...clean]).toEqual(["view", "products.sale", "layout.edit"]);
  });

  it("treats anything that is not an array as nothing stored", () => {
    for (const bad of [null, undefined, "view", 5, {}, { 0: "layout.edit" }]) {
      expect([...cleanSwitches(bad)]).toEqual(["view"]);
    }
  });

  it("returns the set in list order whatever the stored order", () => {
    expect([...cleanSwitches(["store.settings", "products.stock"])]).toEqual(["view", "products.stock", "store.settings"]);
  });

  it("is idempotent and only ever holds known switches", () => {
    fc.assert(
      fc.property(fc.array(fc.oneof(fc.constantFrom(...SWITCHES), fc.string(), fc.integer(), fc.constant(null))), (stored) => {
        const once = cleanSwitches(stored);
        const twice = cleanSwitches([...once]);
        return [...twice].join() === [...once].join() && once.has("view") && [...once].every((s) => SWITCHES.includes(s));
      }),
    );
  });
});

describe("summaryLines", () => {
  it("is one line per switch, in list order", () => {
    const held = new Set<Switch>(["people.manage", "view", "products.stock"]);
    expect(summaryLines(held)).toEqual([SWITCH_TEXT.view.can, SWITCH_TEXT["products.stock"].can, SWITCH_TEXT["people.manage"].can]);
  });

  it("is empty for no switches", () => {
    expect(summaryLines(new Set())).toEqual([]);
  });
});
