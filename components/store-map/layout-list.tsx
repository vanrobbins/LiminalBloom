// Everything on the map as a list (spec §10): the accessible route to every
// item. Choosing one selects it and brings it into view. Zones fold behind an
// arrow (A1); names sort Rack 2 before Rack 10 (UX audit U3) and the type shows
// only when the name doesn't already say it (U10).

"use client";

import { Crosshair } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useOpenGroups } from "@/components/ui/use-open-groups";
import { ZoneFold } from "@/components/ui/zone-fold";
import { FIXTURE_RULES } from "@/lib/layout/fixtures";
import { entranceLabel } from "@/lib/layout/format";
import type { SessionAction } from "@/lib/layout/session";
import { OUTLINE_ID, type Fixture, type Issue, type Layout } from "@/lib/layout/types";
import { byName, typeHint } from "@/lib/natural-sort";

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
  // The zone holding the selection opens itself, so selecting on the map never hides it in the list.
  const selectedZone =
    zones.find((z) => selection.includes(z.id))?.id ??
    layout.fixtures.find((f) => selection.includes(f.id) && f.zoneId !== null)?.zoneId ??
    null;
  const { isOpen, toggle } = useOpenGroups({ storeKey, groupIds: zones.map((z) => z.id), selectedGroupId: selectedZone });
  const lowersOf = (f: Fixture) => {
    const set = layout.tableSets.find((s) => s.upperFixtureId === f.id);
    return set ? byName(layout.fixtures.filter((x) => x.tableSetId === set.id)) : [];
  };

  const fixtureItem = (f: Fixture) => (
    <LayoutListItem
      key={f.id}
      label={f.name}
      detail={typeHint(f.name, FIXTURE_RULES[f.type].label)}
      selected={selection.includes(f.id)}
      problem={problem(f.id)}
      onReveal={reveal(f.id)}
    >
      {lowersOf(f).length > 0 ? <ul className="pl-4">{lowersOf(f).map(fixtureItem)}</ul> : null}
    </LayoutListItem>
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
              action={
                <Button
                  variant={selection.includes(zone.id) ? "primary" : "ghost"}
                  icon
                  aria-label={`Show ${zone.name} on the map`}
                  aria-pressed={selection.includes(zone.id)}
                  onClick={reveal(zone.id)}
                >
                  <Crosshair aria-hidden="true" strokeWidth={1.75} className="size-5" />
                </Button>
              }
            >
              {inside.length > 0 ? <ul className="pl-6">{inside.map(fixtureItem)}</ul> : <p className="pl-8 text-sm text-ink-muted">Nothing in this zone.</p>}
            </ZoneFold>
          );
        })}
        {layout.zones.length === 0 ? <p className="px-3 text-sm text-ink-muted">No zones yet.</p> : null}
      </section>
      {storeLevel.length > 0 ? (
        <section>
          <h2 className="mb-1 text-sm font-medium text-ink-muted">On the store floor</h2>
          <ul>{storeLevel.map(fixtureItem)}</ul>
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
