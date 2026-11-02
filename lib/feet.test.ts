import { describe, expect, it } from "vitest";

import { feetText, parseFeet } from "./feet";

describe("feet", () => {
  it("writes half-foot columns as feet with a ½", () => {
    expect([0, 1, 2, 8, 9, 48].map(feetText)).toEqual(["0", "½", "1", "4", "4½", "24"]);
  });

  it("reads feet typed in half steps, as half-foot columns", () => {
    expect(["4", "4.5", "4½", " 4 ½ ", ".5", "½", "0", "24"].map(parseFeet)).toEqual([8, 9, 9, 9, 1, 1, 0, 48]);
  });

  it("refuses anything that is not a half step of a foot", () => {
    for (const text of ["", "4.25", "-1", "four", "4.5.5", "4ft", "1e1"]) expect(parseFeet(text)).toBeNull();
  });
});
