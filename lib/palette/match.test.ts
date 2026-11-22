import { describe, expect, it } from "vitest";

import { matchAndSort, matchScore } from "./match";

const item = (label: string, keywords = "") => ({ label, keywords });

describe("matchScore", () => {
  it("needs every query word, in the label or the keywords (AND)", () => {
    expect(matchScore(item("Denim Wall · Bay 3"), "denim bay")).not.toBeNull();
    expect(matchScore(item("Denim Wall · Bay 3"), "denim table")).toBeNull();
    expect(matchScore(item("Store", "people team staff"), "people")).not.toBeNull();
    expect(matchScore(item("Store", "people team staff"), "store staff")).not.toBeNull();
  });

  it("ignores case and extra spaces", () => {
    expect(matchScore(item("Rack 2"), "  RACK   2 ")).not.toBeNull();
  });

  it("ranks whole text, then starts with, then a word starts with, then contains, then keywords only", () => {
    const whole = matchScore(item("Rack"), "rack") ?? -1;
    const starts = matchScore(item("Rack 2"), "rack") ?? -1;
    const word = matchScore(item("Front Rack"), "rack") ?? -1;
    const contains = matchScore(item("Tracks"), "rack") ?? -1;
    const keyword = matchScore(item("Store", "rack"), "rack") ?? -1;
    expect([whole, starts, word, contains, keyword]).toEqual([...[whole, starts, word, contains, keyword]].sort((a, b) => b - a));
    expect(new Set([whole, starts, word, contains, keyword]).size).toBe(5);
    expect(keyword).toBeGreaterThanOrEqual(0);
  });
});

describe("matchAndSort", () => {
  it("keeps the given order for an empty query", () => {
    const items = [item("Zebra"), item("Apple")];
    expect(matchAndSort(items, "  ")).toEqual(items);
  });

  it("drops what does not match and puts the best first", () => {
    const out = matchAndSort([item("Front Rack"), item("Tracks"), item("Rack 2"), item("Table")], "rack").map((i) => i.label);
    expect(out).toEqual(["Rack 2", "Front Rack", "Tracks"]);
  });

  it("breaks ties by natural name: Rack 2 before Rack 10", () => {
    const out = matchAndSort([item("Rack 10"), item("Rack 2"), item("Rack 1")], "rack").map((i) => i.label);
    expect(out).toEqual(["Rack 1", "Rack 2", "Rack 10"]);
  });
});
