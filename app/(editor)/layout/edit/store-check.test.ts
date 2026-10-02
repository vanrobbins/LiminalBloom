import { describe, expect, it } from "vitest";

import { checkStore } from "./store-check";

describe("checkStore", () => {
  it("refuses a save meant for a store this session has left (Review Focus 1)", () => {
    expect(checkStore("store-a", "store-b")).toBe("store-changed");
    expect(checkStore("store-a", "store-a")).toBe("ok");
  });
});
