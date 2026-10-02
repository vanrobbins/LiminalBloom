// A zone's name, type, colour and corners; open it to edit its fixtures.

"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FIELD_CLASSES } from "@/components/ui/password-field";
import { ZONE_TYPE_LABEL, formatArea } from "@/lib/layout/format";
import { area } from "@/lib/layout/geometry";
import type { SessionAction } from "@/lib/layout/session";
import { ZONE_TYPES, type Zone, type ZoneType } from "@/lib/layout/types";

import { NameField } from "./name-field";
import { ZoneColorPicker } from "./zone-color-picker";

type ZonePropertiesProps = { zone: Zone; fixtureCount: number; cornerSelected: boolean; dispatch: (action: SessionAction) => void };

export function ZoneProperties({ zone, fixtureCount, cornerSelected, dispatch }: ZonePropertiesProps) {
  const [confirming, setConfirming] = useState(false);
  const update = (changes: Partial<Pick<Zone, "name" | "type" | "color">>) =>
    dispatch({ type: "command", command: { type: "updateZone", id: zone.id, changes } });

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-ink">{zone.name}</h2>
      <NameField key={`${zone.id}:${zone.name}`} label="Zone name" value={zone.name} onCommit={(name) => update({ name })} />
      <label className="flex flex-col gap-1 text-sm text-ink">
        Type
        <select
          className={FIELD_CLASSES}
          value={zone.type}
          onChange={(event) => {
            const type = ZONE_TYPES.find((t) => t === event.target.value);
            if (type) update({ type });
          }}
        >
          {ZONE_TYPES.map((t: ZoneType) => (
            <option key={t} value={t}>
              {ZONE_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </label>
      <ZoneColorPicker value={zone.color} onChange={(color) => update({ color })} />
      <p className="text-sm text-ink-muted">
        {formatArea(area(zone.points))} · {zone.points.length} corners
      </p>
      {cornerSelected ? (
        <Button variant="secondary" onClick={() => dispatch({ type: "delete" })}>
          Remove corner
        </Button>
      ) : (
        <p className="text-sm text-ink-muted">Drag a corner to reshape, or tap + on an edge to add one.</p>
      )}
      <Button variant="secondary" onClick={() => dispatch({ type: "focus", focus: { kind: "zone", id: zone.id } })}>
        Edit fixtures
      </Button>
      <Button variant="danger" onClick={() => setConfirming(true)}>
        Delete zone
      </Button>
      <Dialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Delete ${zone.name}?`}
        description={
          fixtureCount === 0
            ? "Nothing else is removed."
            : `Its ${fixtureCount} ${fixtureCount === 1 ? "fixture stays" : "fixtures stay"} on the map.`
        }
      >
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              setConfirming(false);
              dispatch({ type: "command", command: { type: "delete", ids: [zone.id] } });
            }}
          >
            Delete
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
