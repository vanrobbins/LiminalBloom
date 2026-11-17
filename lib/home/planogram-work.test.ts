import { describe, expect, it } from "vitest";

import { face, fixture } from "@/lib/layout/test-layouts";
import { EMPTY_LAYOUT, type Layout } from "@/lib/layout/types";
import { planogramList, type ListGroup, type ListItem } from "@/lib/planograms/list";
import { storeToday } from "@/lib/time/format";

import { fixturesWithoutPlanogram, planogramWork } from "./planogram-work";

const item = (name: string, o: Partial<ListItem> = {}): ListItem => ({
  fixtureId: name.toLowerCase(),
  name,
  typeLabel: "Rack",
  publishedVersion: null,
  publishedAt: null,
  hasDraft: false,
  dueDate: null,
  ...o,
});
const group = (...items: ListItem[]): ListGroup => ({ zoneId: null, zoneName: "Not in a zone", items });
const names = (g: ListGroup[], today = "2026-11-16", limit?: number) => planogramWork(g, today, limit).rows.map((r) => r.name);

describe("planogramWork", () => {
  it("orders overdue oldest first, then due soonest, then undated drafts by name", () => {
    const g = [
      group(
        item("Undated B", { hasDraft: true }),
        item("Due later", { dueDate: "2026-11-30" }),
        item("Overdue newer", { dueDate: "2026-11-10" }),
        item("Undated A", { hasDraft: true }),
        item("Due soon", { dueDate: "2026-11-18", hasDraft: true }),
        item("Overdue older", { dueDate: "2026-11-01" }),
      ),
    ];
    expect(names(g, "2026-11-16", 10)).toEqual(["Overdue older", "Overdue newer", "Due soon", "Due later", "Undated A", "Undated B"]);
  });

  it("orders across zones, not within them", () => {
    const g = [group(item("A", { dueDate: "2026-11-20" })), group(item("B", { dueDate: "2026-11-12" }))];
    expect(names(g)).toEqual(["B", "A"]);
  });

  it("a due date equal to today is due, not overdue", () => {
    const g = [group(item("Today", { dueDate: "2026-11-16" }), item("Yesterday", { dueDate: "2026-11-15" }), item("Tomorrow", { dueDate: "2026-11-17" }))];
    const w = planogramWork(g, "2026-11-16");
    expect(w.rows.map((r) => r.name)).toEqual(["Yesterday", "Today", "Tomorrow"]);
    expect(w.rows.map((r) => r.overdue)).toEqual([true, false, false]);
  });

  it("puts due today ahead of a later due date but behind an overdue one", () => {
    const g = [group(item("Later", { dueDate: "2026-11-20" }), item("Today", { dueDate: "2026-11-16" }), item("Over", { dueDate: "2026-11-01" }))];
    expect(names(g)).toEqual(["Over", "Today", "Later"]);
  });

  it("puts an overdue date after nothing but ahead of every due date, whatever the dates", () => {
    // An overdue-first rule, not just a date sort: the dates here would sort the same either way,
    // so check the flag the rows carry too.
    const g = [group(item("Due", { dueDate: "2026-11-17" }), item("Over", { dueDate: "2026-11-15" }))];
    expect(planogramWork(g, "2026-11-16").rows.map((r) => [r.name, r.overdue])).toEqual([
      ["Over", true],
      ["Due", false],
    ]);
  });

  it("caps at the limit and reports the total", () => {
    const many = Array.from({ length: 8 }, (_, i) => item(`P${i}`, { dueDate: `2026-11-0${i + 1}` }));
    const w = planogramWork([group(...many)], "2026-11-16");
    expect(w.rows.map((r) => r.name)).toEqual(["P0", "P1", "P2", "P3", "P4"]);
    expect(w.total).toBe(8);
    expect(planogramWork([group(...many)], "2026-11-16", 2)).toMatchObject({ total: 8, rows: [{ name: "P0" }, { name: "P1" }] });
  });

  it("skips a published planogram with no draft and no date", () => {
    const g = [group(item("Done", { publishedVersion: 3 }), item("Fresh", { publishedVersion: 3, dueDate: "2026-11-20" }), item("Untouched"))];
    expect(names(g)).toEqual(["Fresh"]);
    expect(planogramWork(g, "2026-11-16").total).toBe(1);
  });

  it("is empty with no groups", () => {
    expect(planogramWork([], "2026-11-16")).toEqual({ rows: [], total: 0 });
  });

  it("breaks date ties by name, naturally", () => {
    const g = [group(item("Rack 10", { dueDate: "2026-11-20" }), item("Rack 2", { dueDate: "2026-11-20" }))];
    expect(names(g)).toEqual(["Rack 2", "Rack 10"]);
  });

  it("follows the store's today at a UTC midnight boundary", () => {
    const now = new Date("2026-11-17T03:00:00Z");
    const g = [group(item("Mid", { dueDate: "2026-11-16" }), item("Next", { dueDate: "2026-11-17" }), item("Old", { dueDate: "2026-11-10" }))];
    const ny = storeToday("America/New_York", now);
    const tokyo = storeToday("Asia/Tokyo", now);
    expect([ny, tokyo]).toEqual(["2026-11-16", "2026-11-17"]);
    const overdue = (today: string) => planogramWork(g, today).rows.filter((r) => r.overdue).map((r) => r.name);
    // New York is still on the 16th: "Mid" is due today. Tokyo is on the 17th: "Mid" is overdue.
    expect(overdue(ny)).toEqual(["Old"]);
    expect(overdue(tokyo)).toEqual(["Old", "Mid"]);
    expect(names(g, ny)).toEqual(["Old", "Mid", "Next"]);
  });
});

describe("fixturesWithoutPlanogram", () => {
  it("counts fixtures with nothing published and no draft", () => {
    const g = [group(item("A"), item("B", { hasDraft: true }), item("C", { publishedVersion: 1 }), item("D"))];
    expect(fixturesWithoutPlanogram(g)).toBe(2);
  });

  it("excludes lowers and non-anchor run racks (they never reach planogramList)", () => {
    const layout: Layout = {
      ...EMPTY_LAYOUT,
      fixtures: [
        fixture({ id: "upper", type: "table", name: "Front Table set" }),
        fixture({ id: "lower", type: "table", name: "", tableSetId: "set", setSide: "front" }),
        fixture({ id: "r0", type: "rack", name: "Run rack", runId: "run", runIndex: 0 }),
        fixture({ id: "r1", type: "rack", name: "Run rack 2", runId: "run", runIndex: 1 }),
      ],
      faces: ["upper", "lower", "r0", "r1"].map((id) => face({ id: `f-${id}`, fixtureId: id })),
      tableSets: [{ id: "set", upperFixtureId: "upper", version: 1 }],
    };
    expect(fixturesWithoutPlanogram(planogramList(layout, []))).toBe(2);
  });

  it("is 0 for no groups", () => {
    expect(fixturesWithoutPlanogram([])).toBe(0);
  });
});
