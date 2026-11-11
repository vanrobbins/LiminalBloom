import { describe, expect, it } from "vitest";

import { can } from "./can";

describe("can", () => {
  const person = { switches: ["view", "products.edit"] as const };

  it("is true for a switch the person holds", () => {
    expect(can(person, "products.edit")).toBe(true);
    expect(can(person, "view")).toBe(true);
  });

  it("is false for a switch the person lacks", () => {
    expect(can(person, "store.settings")).toBe(false);
    expect(can({ switches: [] }, "view")).toBe(false);
  });
});
