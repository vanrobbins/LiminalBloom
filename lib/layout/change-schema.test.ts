import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { parseChangeSet } from "./change-schema";
import { emptyChanges } from "./diff";

const zoneUpsert = (over: Record<string, unknown> = {}) => ({
  item: {
    id: randomUUID(),
    name: " Front tables ",
    type: "display",
    color: "zone-1",
    points: [{ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 120, y: 120 }],
    version: 0,
    ...over,
  },
  expectedVersion: null,
});

describe("parseChangeSet", () => {
  it("accepts a well-formed change set and trims names", () => {
    const parsed = parseChangeSet({ ...emptyChanges(), zones: [zoneUpsert()] });
    expect(parsed?.zones[0].item.name).toBe("Front tables");
  });

  it("rejects fractions, unknown enums, bad ids and oversized saves", () => {
    expect(parseChangeSet({ ...emptyChanges(), zones: [zoneUpsert({ points: [{ x: 0.5, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }] })] })).toBeNull();
    expect(parseChangeSet({ ...emptyChanges(), zones: [zoneUpsert({ type: "lobby" })] })).toBeNull();
    expect(parseChangeSet({ ...emptyChanges(), zones: [zoneUpsert({ id: "not-a-uuid" })] })).toBeNull();
    const many = Array.from({ length: 501 }, () => zoneUpsert());
    expect(parseChangeSet({ ...emptyChanges(), zones: many })).toBeNull();
  });

  it("rejects non-finite numbers and names that are empty after trimming", () => {
    const corner = (x: number) => [{ x, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }];
    expect(parseChangeSet({ ...emptyChanges(), zones: [zoneUpsert({ points: corner(Number.NaN) })] })).toBeNull();
    expect(parseChangeSet({ ...emptyChanges(), zones: [zoneUpsert({ points: corner(Number.POSITIVE_INFINITY) })] })).toBeNull();
    expect(parseChangeSet({ ...emptyChanges(), zones: [zoneUpsert({ name: "   " })] })).toBeNull();
  });

  it("rejects anything that is not a change set", () => {
    expect(parseChangeSet(null)).toBeNull();
    expect(parseChangeSet({ zones: "everything" })).toBeNull();
  });
});
