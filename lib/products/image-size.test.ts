import { describe, expect, it } from "vitest";

import { fitWithin } from "./image-size";

describe("fitWithin", () => {
  it("shrinks the longest side to 1200 and keeps the shape", () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 1200, height: 900 });
    expect(fitWithin(3024, 4032)).toEqual({ width: 900, height: 1200 });
  });

  it("never enlarges a small image", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
});
