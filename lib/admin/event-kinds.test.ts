import { describe, expect, it } from "vitest";

import { ACTIVITY_FILTER, eventLabel, isEventKind } from "./event-kinds";

describe("platform event kinds (spec 0.7.1 7.5)", () => {
  it("names each action in words", () => {
    expect(eventLabel("signed_out_everywhere")).toBe("Signed out everywhere");
    expect(eventLabel("store_paused")).toBe("Store paused");
  });
  it("shows an unknown action as it is written, so a new kind is never hidden", () => {
    expect(eventLabel("something_new")).toBe("something_new");
  });
  it("only offers the filter what 0.7.1a can write", () => {
    const kinds = ACTIVITY_FILTER.map((k) => k.action);
    expect(kinds).toContain("admin_added");
    expect(kinds).toContain("two_factor_reset");
    expect(kinds).not.toContain("company_approved");
  });
  it("accepts only a known kind as a filter", () => {
    expect(isEventKind("store_paused")).toBe(true);
    expect(isEventKind("drop table")).toBe(false);
    expect(isEventKind(undefined)).toBe(false);
  });
});
