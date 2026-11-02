import { describe, expect, it } from "vitest";

import { CHAPTERS, chapterIndex } from "./chapters";

describe("walkthrough chapters", () => {
  it("gives every chapter a unique id that is safe in a URL hash", () => {
    const ids = CHAPTERS.map((chapter) => chapter.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((id) => !/^[a-z0-9-]+$/.test(id))).toEqual([]);
  });

  it("gives every chapter at least one point to mark on its screen", () => {
    expect(CHAPTERS.filter((chapter) => chapter.points.length === 0)).toEqual([]);
  });

  it("finds a chapter by its hash, with or without the #", () => {
    expect(chapterIndex("#store-map")).toBe(chapterIndex("store-map"));
    expect(CHAPTERS[chapterIndex("#store-map")].id).toBe("store-map");
  });

  it("opens the first chapter for an empty or unknown hash", () => {
    expect(chapterIndex("")).toBe(0);
    expect(chapterIndex("#nope")).toBe(0);
  });
});
