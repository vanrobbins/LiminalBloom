import { describe, expect, it } from "vitest";

import { checkSpot, firstFit } from "./grid";
import { demoReducer, working } from "./reducer";
import { FIXTURES, seedState } from "./seed";
import { notPlaced, placementOf, searchProducts, soldOutOnDisplay, suggestionsFor } from "./selectors";
import { feet, locationWords } from "./words";

const denimFace = FIXTURES[0].faces[0];

describe("the demo grid", () => {
  it("refuses a spot past the edge, and names what blocks an overlap", () => {
    const placements = seedState().published.filter((p) => p.fixtureId === "denim-wall");
    expect(checkSpot(denimFace, placements, { faceId: "front", col: 14, row: 0, w: 4, h: 1 })).toEqual({ ok: false, reason: "edge" });
    const blocked = checkSpot(denimFace, placements, { faceId: "front", col: 3, row: 2, w: 2, h: 1 });
    expect(blocked.ok === false && blocked.reason === "blocked" && blocked.by.productId).toBe("straight");
  });

  it("finds the first open spot from the top left", () => {
    const placements = seedState().published.filter((p) => p.fixtureId === "denim-wall");
    expect(firstFit(denimFace, placements, { w: 3, h: 1 })).toMatchObject({ col: 0, row: 0 });
  });
});

describe("demo words", () => {
  it("says columns as half feet and places as the floor says them", () => {
    expect([feet(0), feet(1), feet(5)]).toEqual(["0", "½", "2½"]);
    const straight = placementOf(seedState(), "straight")!;
    expect(locationWords(straight)).toBe("Denim wall · Bottom shelf · 2–4 ft from left");
  });
});

describe("demo search", () => {
  it("forgives dropped letters, and ranks name matches first", () => {
    // The short is found through its category, Pants, so it comes second.
    expect(searchProducts(seedState().products, "hi rise pnt").map((p) => p.name)).toEqual(["High-rise pant", "High-rise short"]);
  });
});

describe("the demo store's changes", () => {
  it("starts a draft on the first move, undoes back to no draft, and refuses an overlap", () => {
    let state = seedState();
    const move = { type: "move", placementId: "pl-1", fixtureId: "denim-wall", faceId: "front", row: 0 } as const;
    state = demoReducer(state, { ...move, col: 0 });
    expect(state.drafts["denim-wall"]).toBeDefined();
    expect(placementOf(state, "hr-pant")).toMatchObject({ row: 1 }); // published unchanged until publish

    const refused = demoReducer(state, { ...move, row: 2, col: 3 });
    expect(refused).toBe(state);

    state = demoReducer(state, { type: "undo", fixtureId: "denim-wall" });
    expect(state.drafts["denim-wall"]).toBeUndefined();
  });

  it("publishes a draft as a new version that search then answers from", () => {
    let state = seedState();
    state = demoReducer(state, { type: "add", fixtureId: "denim-wall", faceId: "front", productId: "mid-rise", presentation: "folded" });
    expect(placementOf(state, "mid-rise")).toBeUndefined();
    state = demoReducer(state, { type: "publish", fixtureId: "denim-wall" });
    expect(placementOf(state, "mid-rise")).toMatchObject({ row: 0, col: 0 });
    expect(state.versions["denim-wall"]).toBe(5);
    expect(working(state, "denim-wall")).toHaveLength(5);
  });

  it("runs the core loop: sold out, a gap, a suggestion that fits, adjusted", () => {
    let state = demoReducer(seedState(), { type: "status", productId: "straight", status: "sold_out" });
    const gap = soldOutOnDisplay(state).find((p) => p.productId === "straight")!;
    const suggested = suggestionsFor(state, gap).map((p) => p.id);
    expect(suggested[0]).toBe("mid-rise");
    expect(suggested).toContain("wide-leg");

    state = demoReducer(state, { type: "adjust", placementId: gap.id, productId: "wide-leg" });
    expect(placementOf(state, "wide-leg")).toMatchObject({ col: 4, row: 2, adjusted: true });
    expect(placementOf(state, "straight")).toBeUndefined();
    expect(soldOutOnDisplay(state).map((p) => p.productId)).toEqual(["crew-sock"]);
    expect(notPlaced(state).map((p) => p.id)).not.toContain("wide-leg");
  });
});
