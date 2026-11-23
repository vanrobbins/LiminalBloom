import { describe, expect, it } from "vitest";

import { activityParams, showMoreHref } from "./activity-params";

describe("activityParams", () => {
  it("starts at 50 of everything", () => {
    expect(activityParams({})).toEqual({ limit: 50, kind: undefined });
  });
  it("reads a limit and a known kind", () => {
    expect(activityParams({ limit: "150", kind: "store_paused" })).toEqual({ limit: 150, kind: "store_paused" });
  });
  it("falls back for anything odd: below 50, not a number, a list, an unknown kind", () => {
    expect(activityParams({ limit: "10" }).limit).toBe(50);
    expect(activityParams({ limit: "abc" }).limit).toBe(50);
    expect(activityParams({ limit: "1.5e2" }).limit).toBe(150);
    expect(activityParams({ limit: ["100", "200"] }).limit).toBe(100);
    expect(activityParams({ kind: "drop table" }).kind).toBeUndefined();
  });
  it("rounds a limit down to a multiple of 50", () => {
    expect(activityParams({ limit: "149" }).limit).toBe(100);
    expect(activityParams({ limit: "75" }).limit).toBe(50);
  });
  it("never asks for more than 1000", () => {
    expect(activityParams({ limit: "999999" }).limit).toBe(1000);
  });
  it("links to 50 more, keeping the kind", () => {
    expect(showMoreHref({ limit: 50, kind: undefined })).toBe("/admin/activity?limit=100");
    expect(showMoreHref({ limit: 100, kind: "admin_added" })).toBe("/admin/activity?limit=150&kind=admin_added");
  });
});
