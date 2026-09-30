// The only place product status presentation is decided (§5.5).

import { describe, expect, it } from "vitest";

import { productStatus } from "@/db/schema";

import { PRODUCT_STATUS } from "./product-status";

describe("PRODUCT_STATUS", () => {
  it("covers every status the database allows", () => {
    expect(Object.keys(PRODUCT_STATUS).sort()).toEqual(
      [...productStatus.enumValues].sort(),
    );
  });

  it.each(productStatus.enumValues)("gives %s a word and an icon", (status) => {
    const { label, icon } = PRODUCT_STATUS[status];
    expect(label.trim()).not.toBe("");
    expect(icon).toBeDefined();
  });

  it("never uses gold for a status", () => {
    for (const { tone } of Object.values(PRODUCT_STATUS)) {
      expect(["ok", "danger", "info"]).toContain(tone);
    }
  });

  it("gives each status its own tone", () => {
    const tones = Object.values(PRODUCT_STATUS).map(({ tone }) => tone);
    expect(new Set(tones).size).toBe(tones.length);
  });
});
