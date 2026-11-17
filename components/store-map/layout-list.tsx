// Everything on the map as a list (spec §10): the accessible route to every
// item. Choosing one selects it and brings it into view. Zones fold behind an
// arrow (A1), and the rest of a zone's row selects it; runs and table sets fold
// inside their zone the same way. Names sort Rack 2 before Rack 10 (UX audit U3)
// and the type shows only when the name doesn't already say it (U10).

"use client";

import { useOpenGroups } from "@/components/ui/use-open-groups";
import { ZoneFold } from "@/components/ui/zone-fold";
import { entranceLabel } from "@/lib/layout/format";
import type { SessionAction } from "@/lib/layout/session";
import { OUTLINE_ID, type Fixture, type Issue, type Layout } from "@/lib/layout/types";
import { byName } from "@/lib/natural-sort";

import { LayoutFixtures } from "./layout-fixtures";
import { LayoutListItem } from "./layout-list-item";

type LayoutListProps = {
  layout: Layout;
  selection: readonly string[];
  issues: readonly Issue[];
  dispatch: (action: SessionAction) => void;
  /** Keys the remembered open zones on this device (A1). */
  storeKey: string;
};

export function LayoutList({ layout, selection, issues, dispatch, storeKey }: LayoutListProps) {
  const problem = (id: string) => issues.find((issue) => issue.itemId === id)?.message;
  const reveal = (id: string) => () => dispatch({ type: "reveal", id });
  const plain = byName(layout.fixtures.filter((f) => f.tableSetId === null));
  const zones = byName(layout.zones);
  // The zone holding the selection opens itself, and so do the run and table set inside it, so selecting on the map never hides it in the list.
  const picked = layout.fixtures.filter((f) => selection.includes(f.id));
  const selectedZone = zones.find((z) => selection.includes(z.id))?.id ?? picked.find((f) => f.zoneId !== null)?.zoneId ?? null;
  const upperOf = (f: Fixture) => layout.tableSets.find((s) => s.id === f.tableSetId)?.upperFixtureId ?? f.id;
  const selectedInner = picked.flatMap((f) => [f.runId, upperOf(f)]);
  const { isOpen, toggle } = useOpenGroups({ storeKey, groupIds: zones.map((z) => z.id), selectedGroupId: [selectedZone, ...selectedInner] });
  const fixtures = (zoneId: string | null, className?: string) => (
    <LayoutFixtures layout={layout} fixtures={plain.filter((f) => f.zoneId === zoneId)} selection={selection} problem={problem} dispatch={dispatch} isOpen={isOpen} toggle={toggle} className={className} />
  );

  const storeLevel = plain.filter((f) => f.zoneId === null);

  return (
    <nav aria-label="Everything on the map" className="flex flex-col gap-4 p-4">
      <ul>
        {layout.outline ? (
          <LayoutListItem label="Store outline" selected={selection.includes(OUTLINE_ID)} problem={problem(OUTLINE_ID)} onReveal={reveal(OUTLINE_ID)} />
        ) : null}
      </ul>
      <section className="flex flex-col gap-1">
        <h2 className="mb-1 text-sm font-medium text-ink-muted">Zones</h2>
        {zones.map((zone) => {
          const inside = plain.filter((f) => f.zoneId === zone.id);
          const zoneProblem = problem(zone.id);
          return (
            <ZoneFold
              key={zone.id}
              as="h3"
              title={zone.name}
              count={inside.length}
              summary={zoneProblem ? <span className="text-danger">{zoneProblem}</span> : undefined}
              open={isOpen(zone.id)}
              onToggle={() => toggle(zone.id)}
              selected={selection.includes(zone.id)}
              onSelect={reveal(zone.id)}
            >
              {inside.length > 0 ? fixtures(zone.id, "pl-6") : <p className="pl-8 text-sm text-ink-muted">Nothing in this zone.</p>}
            </ZoneFold>
          );
        })}
        {layout.zones.length === 0 ? <p className="px-3 text-sm text-ink-muted">No zones yet.</p> : null}
      </section>
      {storeLevel.length > 0 ? (
        <section>
          <h2 className="mb-1 text-sm font-medium text-ink-muted">On the store floor</h2>
          {fixtures(null)}
        </section>
      ) : null}
      {layout.entrances.length > 0 ? (
        <section>
          <h2 className="mb-1 text-sm font-medium text-ink-muted">Entrances</h2>
          <ul>
            {layout.entrances.map((e) => (
              <LayoutListItem key={e.id} label={entranceLabel(layout, e.id)} selected={selection.includes(e.id)} problem={problem(e.id)} onReveal={reveal(e.id)} />
            ))}
          </ul>
        </section>
      ) : null}
    </nav>
  );
}
