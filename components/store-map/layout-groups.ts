// How the list groups a zone's (or the store floor's) fixtures: frame racks
// joined in a run, a table with lower tables, and everything else on its own.

import { byName } from "@/lib/natural-sort";
import type { Fixture, Layout } from "@/lib/layout/types";

/** The open/closed key of a run's part in one zone: a run split across zones folds each part on its own. */
export const runKey = (runId: string, zoneId: string | null) => `${runId}:${zoneId ?? ""}`;

export type RunGroup = {
  id: string;
  /** Keys this part's fold (see runKey). */
  key: string;
  /** "Run · first–last": a run has no name of its own. */
  title: string;
  /** The racks here, in run order. */
  racks: Fixture[];
  /** Every rack of the run, even any in another zone: what choosing the row selects. */
  ids: string[];
};

export type SetGroup = { upper: Fixture; lowers: Fixture[] };

const inRun = (a: Fixture, b: Fixture) => (a.runIndex ?? 0) - (b.runIndex ?? 0);

/** `fixtures` are the ones that aren't lower tables. A table with no lowers is loose. */
export function groupFixtures(layout: Layout, fixtures: Fixture[]) {
  const runs: RunGroup[] = [];
  const sets: SetGroup[] = [];
  const loose: Fixture[] = [];
  for (const f of byName(fixtures)) {
    const set = layout.tableSets.find((s) => s.upperFixtureId === f.id);
    const lowers = set ? byName(layout.fixtures.filter((x) => x.tableSetId === set.id)) : [];
    if (f.runId !== null) {
      if (runs.some((r) => r.id === f.runId)) continue;
      const racks = fixtures.filter((x) => x.runId === f.runId).sort(inRun);
      const ids = layout.fixtures.filter((x) => x.runId === f.runId).sort(inRun).map((x) => x.id);
      const names = racks.length > 1 ? `${racks[0].name}–${racks[racks.length - 1].name}` : racks[0].name;
      runs.push({ id: f.runId, key: runKey(f.runId, f.zoneId), title: `Run · ${names}`, racks, ids });
    } else if (lowers.length > 0) sets.push({ upper: f, lowers });
    else loose.push(f);
  }
  return { runs, sets, loose };
}
