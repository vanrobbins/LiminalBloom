import { describe, expect, it } from "vitest";

import type { AdjustmentState } from "./adjust";
import { endingWords, revertWords } from "./adjust-words";
import { emptying, entry, replacing } from "./test-adjust";

const straight = entry({ productId: "straight", productName: "Straight jean" });
const tee = entry({ productId: "tee", productName: "Pocket tee", col: 4, fixtureName: "Front table 1" });
const published = (...changes: AdjustmentState["changes"]): AdjustmentState => ({
  id: "a", planogramId: "p", state: "published", basedOnVersion: 3, version: 2, createdByName: "Sam", createdAt: new Date(), publishedAt: new Date(), publishedByName: "Van", changes,
});
const row = (change: ReturnType<typeof replacing>) => ({ ...change, id: "c", version: 1 });

describe("endingWords", () => {
  it("names the two products and where, and says a tile was left empty", () => {
    expect(endingWords({ kind: "replace", fixtureName: "Wall bay 3", faceLabel: "Front", from: "Straight jean", to: "Slim jean" })).toBe("Straight jean → Slim jean (Wall bay 3)");
    expect(endingWords({ kind: "empty", fixtureName: "Wall bay 3", faceLabel: "Front", from: "Straight jean", to: null })).toBe("Straight jean → left empty (Wall bay 3)");
  });
});

describe("revertWords", () => {
  it("says each product goes back, and that it is sold out when it is", () => {
    const changes = [row(replacing(straight, "slim")), row(emptying(tee) as ReturnType<typeof replacing>)];
    const looks = { straight: { imageKey: null, categoryName: "Jeans", status: "sold_out" as const }, tee: { imageKey: null, categoryName: "Tees", status: "in_stock" as const } };
    expect(revertWords(published(...changes), [straight, tee], looks)).toEqual([
      "Straight jean goes back on Wall bay 3, though it is sold out.",
      "Pocket tee goes back on Front table 1.",
    ]);
  });

  it("leaves out a tile that is no longer in the version, and a product with no look", () => {
    expect(revertWords(published(row(replacing(straight, "slim"))), [], {})).toEqual([]);
    expect(revertWords(published(row(replacing(straight, "slim"))), [straight], {})).toEqual(["Straight jean goes back on Wall bay 3."]);
  });
});
