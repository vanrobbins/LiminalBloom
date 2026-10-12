import { describe, expect, it } from "vitest";

import { swipeTarget } from "./face-swipe";

const faces = ["front", "back", "left"];
const flush = { left: false, right: false };

describe("swipeTarget", () => {
  it("a swipe left shows the next face, sliding in from the right", () => {
    expect(swipeTarget(faces, "front", { dx: -80, dy: 5, edges: flush })).toEqual({ faceId: "back", from: "right" });
  });
  it("a swipe right shows the previous face", () => {
    expect(swipeTarget(faces, "back", { dx: 80, dy: 0, edges: flush })).toEqual({ faceId: "front", from: "left" });
  });
  it("vertical movement wins: that is a page scroll", () => {
    expect(swipeTarget(faces, "front", { dx: -60, dy: 40, edges: flush })).toBeNull();
  });
  it("a short drag is a tap", () => {
    expect(swipeTarget(faces, "front", { dx: -20, dy: 0, edges: flush })).toBeNull();
  });
  it("a grid that can still scroll that way scrolls instead", () => {
    expect(swipeTarget(faces, "front", { dx: -80, dy: 0, edges: { left: false, right: true } })).toBeNull();
    expect(swipeTarget(faces, "back", { dx: 80, dy: 0, edges: { left: true, right: false } })).toBeNull();
  });
  it("stops at the first and last face", () => {
    expect(swipeTarget(faces, "left", { dx: -80, dy: 0, edges: flush })).toBeNull();
    expect(swipeTarget(faces, "front", { dx: 80, dy: 0, edges: flush })).toBeNull();
  });
});
