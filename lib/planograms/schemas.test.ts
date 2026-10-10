import { describe, expect, it } from "vitest";

import { changeInput, dueDateInput, summaryInput } from "./schemas";

const fields = { faceId: "00000000-0000-4000-8000-000000000001", presentation: "folded", col: 0, row: 0, colSpan: 2, rowSpan: 2, pieceCount: 4 };

describe("planogram inputs", () => {
  it("accepts each kind of change", () => {
    expect(changeInput.safeParse({ kind: "add", productId: "00000000-0000-4000-8000-000000000002", fields }).success).toBe(true);
    expect(changeInput.safeParse({ kind: "update", id: "00000000-0000-4000-8000-000000000003", version: 2, fields }).success).toBe(true);
    expect(changeInput.safeParse({ kind: "remove", id: "00000000-0000-4000-8000-000000000003", version: 2 }).success).toBe(true);
  });

  it("refuses cells, spans and counts outside the table's limits", () => {
    for (const bad of [{ col: 24 }, { colSpan: 0 }, { pieceCount: 100 }, { pieceCount: 1.5 }, { presentation: "draped" }]) {
      expect(changeInput.safeParse({ kind: "add", productId: "00000000-0000-4000-8000-000000000002", fields: { ...fields, ...bad } }).success).toBe(false);
    }
    expect(changeInput.safeParse({ kind: "update", id: "x", version: 1, fields }).success).toBe(false);
  });

  it("takes an ISO date or nothing for a due date, and trims the summary", () => {
    expect(dueDateInput.parse("2026-10-15")).toBe("2026-10-15");
    expect(dueDateInput.parse(null)).toBeNull();
    expect(dueDateInput.safeParse("Oct 15").success).toBe(false);
    expect(dueDateInput.safeParse("0002-10-15").success).toBe(false);
    expect(summaryInput.parse("  October denim reset ")).toBe("October denim reset");
    expect(summaryInput.parse("   ")).toBeNull();
    expect(summaryInput.safeParse("x".repeat(201)).success).toBe(false);
  });
});
