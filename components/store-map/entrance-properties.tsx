// An entrance's width, and removing it.

"use client";

import { Button } from "@/components/ui/button";
import { FeetInchesInput } from "@/components/ui/feet-inches-input";
import { MAX_ENTRANCE_WIDTH, MIN_ENTRANCE_WIDTH } from "@/lib/layout/limits";
import type { SessionAction } from "@/lib/layout/session";
import type { Entrance } from "@/lib/layout/types";

type EntrancePropertiesProps = { entrance: Entrance; label: string; dispatch: (action: SessionAction) => void };

export function EntranceProperties({ entrance, label, dispatch }: EntrancePropertiesProps) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-ink">{label}</h2>
      <FeetInchesInput
        key={`${entrance.id}:${entrance.width}`}
        label="Width"
        value={entrance.width}
        min={MIN_ENTRANCE_WIDTH}
        max={MAX_ENTRANCE_WIDTH}
        onCommit={(width) => dispatch({ type: "command", command: { type: "updateEntrance", id: entrance.id, changes: { width } } })}
      />
      <p className="text-sm text-ink-muted">Drag it along a wall, or drag its ends to resize.</p>
      <Button variant="danger" onClick={() => dispatch({ type: "command", command: { type: "delete", ids: [entrance.id] } })}>
        Remove entrance
      </Button>
    </div>
  );
}
