import { describe, expect, it } from "vitest";

import { dueLabel, formatDay } from "./dates";

describe("planogram dates", () => {
  it("writes days the short way, without a time-zone shift", () => {
    expect(formatDay("2026-10-08")).toBe("Oct 8");
  });

  it("says due or overdue", () => {
    expect(dueLabel("2026-10-15", "2026-10-08")).toEqual({ text: "Due Oct 15", overdue: false });
    expect(dueLabel("2026-10-08", "2026-10-08")).toEqual({ text: "Due Oct 8", overdue: false });
    expect(dueLabel("2026-10-01", "2026-10-08")).toEqual({ text: "Overdue · Oct 1", overdue: true });
  });
});
