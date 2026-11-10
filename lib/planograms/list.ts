// The planogram list (spec §5.1): every fixture that shows product, grouped by
// zone, zoneless last; zones and fixtures by name, Rack 2 before Rack 10 (UX audit U3). Lower tables are covered by their upper.

import { FIXTURE_RULES } from "@/lib/layout/fixtures";
import type { Layout } from "@/lib/layout/types";
import { byName, compareNames } from "@/lib/natural-sort";

export type PlanogramSummary = {
  fixtureId: string;
  publishedVersion: number | null;
  publishedAt: Date | null;
  hasDraft: boolean;
  dueDate: string | null;
};
export type ListItem = Omit<PlanogramSummary, "fixtureId"> & { fixtureId: string; name: string; typeLabel: string };
/** `zoneId` is null for "Not in a zone"; it keys the group's fold (A1). */
export type ListGroup = { zoneId: string | null; zoneName: string; items: ListItem[] };

export function planogramList(layout: Layout, summaries: readonly PlanogramSummary[]): ListGroup[] {
  const byFixture = new Map(summaries.map((s) => [s.fixtureId, s]));
  const shown = layout.fixtures
    // A run is listed once, by its anchor (frame racks spec §4.2).
    .filter((f) => f.tableSetId === null && (f.runId === null || f.runIndex === 0) && layout.faces.some((face) => face.fixtureId === f.id))
    .sort((a, b) => compareNames(a.name, b.name));
  const item = (f: (typeof shown)[number]): ListItem => {
    const s = byFixture.get(f.id);
    return {
      fixtureId: f.id,
      name: f.name,
      typeLabel: FIXTURE_RULES[f.type].label,
      publishedVersion: s?.publishedVersion ?? null,
      publishedAt: s?.publishedAt ?? null,
      hasDraft: s?.hasDraft ?? false,
      dueDate: s?.dueDate ?? null,
    };
  };
  const groups: ListGroup[] = byName(layout.zones).map((z) => ({ zoneId: z.id, zoneName: z.name, items: shown.filter((f) => f.zoneId === z.id).map(item) }));
  groups.push({ zoneId: null, zoneName: "Not in a zone", items: shown.filter((f) => !layout.zones.some((z) => z.id === f.zoneId)).map(item) });
  return groups.filter((g) => g.items.length > 0);
}
