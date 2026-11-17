// A zone's (or the store floor's) fixtures in the list: runs and table sets
// as folds inside it, the rest as plain rows. Each fold's arrow folds it and
// the rest of its row selects, like the zone's own.

"use client";

import { ZoneFold } from "@/components/ui/zone-fold";
import { FIXTURE_RULES } from "@/lib/layout/fixtures";
import type { SessionAction } from "@/lib/layout/session";
import type { Fixture, Layout } from "@/lib/layout/types";
import { typeHint } from "@/lib/natural-sort";

import { groupFixtures } from "./layout-groups";
import { LayoutListItem } from "./layout-list-item";

type LayoutFixturesProps = {
  layout: Layout;
  /** The ones here that aren't lower tables. */
  fixtures: Fixture[];
  selection: readonly string[];
  problem: (id: string) => string | undefined;
  dispatch: (action: SessionAction) => void;
  isOpen: (id: string) => boolean;
  toggle: (id: string) => void;
  className?: string;
};

export function LayoutFixtures({ layout, fixtures, selection, problem, dispatch, isOpen, toggle, className }: LayoutFixturesProps) {
  const { runs, sets, loose } = groupFixtures(layout, fixtures);
  const row = (f: Fixture) => (
    <LayoutListItem
      key={f.id}
      label={f.name}
      detail={typeHint(f.name, FIXTURE_RULES[f.type].label)}
      selected={selection.includes(f.id)}
      problem={problem(f.id)}
      onReveal={() => dispatch({ type: "reveal", id: f.id })}
    />
  );
  return (
    <div className={`flex flex-col gap-1 ${className ?? ""}`}>
      {runs.map((run) => (
        <ZoneFold
          key={run.id}
          as="h4"
          title={run.title}
          count={run.racks.length}
          open={isOpen(run.id)}
          onToggle={() => toggle(run.id)}
          selected={run.ids.every((id) => selection.includes(id))}
          onSelect={() => dispatch({ type: "reveal", id: run.ids[0], ids: run.ids })}
        >
          <ul className="pl-6">{run.racks.map(row)}</ul>
        </ZoneFold>
      ))}
      {sets.map(({ upper, lowers }) => (
        <ZoneFold
          key={upper.id}
          as="h4"
          title={upper.name}
          count={lowers.length}
          summary={problem(upper.id) ? <span className="text-danger">{problem(upper.id)}</span> : undefined}
          open={isOpen(upper.id)}
          onToggle={() => toggle(upper.id)}
          selected={selection.includes(upper.id)}
          onSelect={() => dispatch({ type: "reveal", id: upper.id })}
        >
          <ul className="pl-6">{lowers.map(row)}</ul>
        </ZoneFold>
      ))}
      {loose.length > 0 ? <ul>{loose.map(row)}</ul> : null}
    </div>
  );
}
