import { describe, expect, it } from "vitest";

import { searchInput } from "./schemas";
import { fromSearchParams, hasFilters, toSearchParams } from "./search-params";

const id = "6f1c3b4e-8a43-4b8e-9b5d-4f7c2a1e9d10";

describe("search params", () => {
  it("round-trips the query and filters through the URL", () => {
    const input = fromSearchParams({ q: "pant", category: [id], color: "Black", status: ["sold_out", "on_sale"], place: "floor" });
    expect(input).toEqual({ q: "pant", categoryIds: [id], colors: ["Black"], statuses: ["sold_out", "on_sale"], places: ["floor"] });
    expect(toSearchParams(input).toString()).toBe(`q=pant&category=${id}&color=Black&status=sold_out&status=on_sale&place=floor`);
  });

  it("drops anything it does not understand instead of failing", () => {
    expect(fromSearchParams({ q: ["a", "b"], category: "not-a-uuid", status: "lost" })).toEqual({ q: "a", categoryIds: [], colors: [], statuses: [], places: [] });
  });

  it("de-duplicates and caps statuses and places so the server still accepts them", () => {
    const input = fromSearchParams({ status: ["in_stock", "in_stock", "in_stock", "in_stock"], place: ["floor", "floor", "floor", "floor"] });
    expect(input.statuses).toEqual(["in_stock"]);
    expect(input.places).toEqual(["floor"]);
    expect(searchInput.safeParse(input).success).toBe(true);
  });

  it("knows when filters are on", () => {
    expect(hasFilters(fromSearchParams({ q: "x" }))).toBe(false);
    expect(hasFilters(fromSearchParams({ place: "unplaced" }))).toBe(true);
  });
});
