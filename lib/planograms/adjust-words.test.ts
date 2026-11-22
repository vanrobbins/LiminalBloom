import { describe, expect, it } from "vitest";

import type { AdjustmentState } from "./adjust";
import { changeWords, endingWords, revertWords } from "./adjust-words";
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

describe("changeWords", () => {
  it("is one line per changed tile, in the order of the version: the two products, or left empty", () => {
    const slim = { ...straight, productId: "slim", productName: "Slim jean" };
    expect(changeWords([straight, tee], [slim, tee])).toEqual([{ faceId: "f1", text: "Wall bay 3 · Front: Straight jean → Slim jean" }]);
    expect(changeWords([straight, tee], [straight])).toEqual([{ faceId: "f1", text: "Front table 1 · Front: Pocket tee → left empty" }]);
  });

  it("says nothing for tiles that did not change, nor when nothing did", () => {
    expect(changeWords([straight, tee], [straight, tee])).toEqual([]);
  });

  it("pairs a replacement with the tile at the same spot and depth, not another layer", () => {
    const back = entry({ productId: "belt", productName: "Belt", presentation: "hung", depth: 1, col: 6 });
    const front = { ...back, productId: "scarf", productName: "Scarf", depth: 0 };
    const slimBack = { ...back, productId: "slim", productName: "Slim belt" };
    expect(changeWords([front, back], [front, slimBack])).toEqual([{ faceId: "f1", text: "Wall bay 3 · Front: Belt → Slim belt" }]);
  });
});
