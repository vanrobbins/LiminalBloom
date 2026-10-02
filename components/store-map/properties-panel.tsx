// Shows the right panel for what is selected (spec §10).

"use client";

import { entranceLabel } from "@/lib/layout/format";
import type { SessionAction } from "@/lib/layout/session";
import type { Session } from "@/lib/layout/session-core";
import { OUTLINE_ID } from "@/lib/layout/types";

import { EntranceProperties } from "./entrance-properties";
import { FixtureProperties } from "./fixture-properties";
import { OutlineProperties } from "./outline-properties";
import { SelectionProperties } from "./selection-properties";
import { ZoneProperties } from "./zone-properties";

export function PropertiesPanel({ session, dispatch }: { session: Session; dispatch: (action: SessionAction) => void }) {
  const { layout, selection, vertex } = session;
  if (selection.length > 1) return <SelectionProperties count={selection.length} dispatch={dispatch} />;
  const [id] = selection;
  if (!id) return null;

  if (id === OUTLINE_ID && layout.outline) {
    return <OutlineProperties outline={layout.outline} cornerSelected={vertex?.owner.kind === "outline"} dispatch={dispatch} />;
  }
  const zone = layout.zones.find((z) => z.id === id);
  if (zone) {
    return (
      <ZoneProperties
        zone={zone}
        fixtureCount={layout.fixtures.filter((f) => f.zoneId === zone.id && f.tableSetId === null).length}
        cornerSelected={vertex?.owner.kind === "zone" && vertex.owner.id === zone.id}
        dispatch={dispatch}
      />
    );
  }
  const fixture = layout.fixtures.find((f) => f.id === id);
  if (fixture) return <FixtureProperties layout={layout} fixture={fixture} dispatch={dispatch} />;
  const entrance = layout.entrances.find((e) => e.id === id);
  if (entrance) return <EntranceProperties entrance={entrance} label={entranceLabel(layout, id)} dispatch={dispatch} />;
  return null;
}
