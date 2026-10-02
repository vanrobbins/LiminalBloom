// Everything on the map as a list (spec §10): the accessible route to every
// item. Choosing one selects it and brings it into view.

"use client";

import { FIXTURE_RULES } from "@/lib/layout/fixtures";
import { entranceLabel } from "@/lib/layout/format";
import type { SessionAction } from "@/lib/layout/session";
import { OUTLINE_ID, type Fixture, type Issue, type Layout } from "@/lib/layout/types";

import { LayoutListItem } from "./layout-list-item";

type LayoutListProps = { layout: Layout; selection: readonly string[]; issues: readonly Issue[]; dispatch: (action: SessionAction) => void };

export function LayoutList({ layout, selection, issues, dispatch }: LayoutListProps) {
  const problem = (id: string) => issues.find((issue) => issue.itemId === id)?.message;
  const reveal = (id: string) => () => dispatch({ type: "reveal", id });
  const plain = layout.fixtures.filter((f) => f.tableSetId === null);
  const lowersOf = (f: Fixture) => {
    const set = layout.tableSets.find((s) => s.upperFixtureId === f.id);
    return set ? layout.fixtures.filter((x) => x.tableSetId === set.id) : [];
  };

  const fixtureItem = (f: Fixture) => (
    <LayoutListItem
      key={f.id}
      label={f.name}
      detail={FIXTURE_RULES[f.type].label}
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
      <section>
        <h2 className="mb-1 text-sm font-medium text-ink-muted">Zones</h2>
        <ul>
          {layout.zones.map((zone) => {
            const inside = plain.filter((f) => f.zoneId === zone.id);
            return (
              <LayoutListItem key={zone.id} label={zone.name} selected={selection.includes(zone.id)} problem={problem(zone.id)} onReveal={reveal(zone.id)}>
                {inside.length > 0 ? <ul className="pl-4">{inside.map(fixtureItem)}</ul> : null}
              </LayoutListItem>
            );
          })}
        </ul>
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
