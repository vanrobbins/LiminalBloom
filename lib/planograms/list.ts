// The planogram list (spec §5.1): every fixture that shows product, grouped by
// zone in map order, zoneless last. Lower tables are covered by their upper.

import { FIXTURE_RULES } from "@/lib/layout/fixtures";
import type { Layout } from "@/lib/layout/types";

export type PlanogramSummary = {
  fixtureId: string;
  publishedVersion: number | null;
  publishedAt: Date | null;
  hasDraft: boolean;
  dueDate: string | null;
};
export type ListItem = Omit<PlanogramSummary, "fixtureId"> & { fixtureId: string; name: string; typeLabel: string };
export type ListGroup = { zoneName: string; items: ListItem[] };

export function planogramList(layout: Layout, summaries: readonly PlanogramSummary[]): ListGroup[] {
  const byFixture = new Map(summaries.map((s) => [s.fixtureId, s]));
  const shown = layout.fixtures
    .filter((f) => f.tableSetId === null && layout.faces.some((face) => face.fixtureId === f.id))
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
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
  const groups = layout.zones.map((z) => ({ zoneName: z.name, items: shown.filter((f) => f.zoneId === z.id).map(item) }));
  groups.push({ zoneName: "Not in a zone", items: shown.filter((f) => !layout.zones.some((z) => z.id === f.zoneId)).map(item) });
  return groups.filter((g) => g.items.length > 0);
}
