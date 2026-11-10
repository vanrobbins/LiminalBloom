// Several items selected: what can be done to all of them at once. Two to six
// frame racks, or two to six wall bays, on their own can be linked into a run
// (frame racks spec §4.3, run joins spec §2.3).

"use client";

import { Button } from "@/components/ui/button";
import { MAX_RUN_RACKS, MIN_RUN_RACKS, isRunType } from "@/lib/layout/runs";
import type { SessionAction } from "@/lib/layout/session";
import type { Layout } from "@/lib/layout/types";

type SelectionPropertiesProps = { layout: Layout; ids: readonly string[]; dispatch: (action: SessionAction) => void };

export function SelectionProperties({ layout, ids, dispatch }: SelectionPropertiesProps) {
  const picked = layout.fixtures.filter((f) => ids.includes(f.id));
  const canLink =
    picked.length === ids.length &&
    picked.length >= MIN_RUN_RACKS &&
    picked.length <= MAX_RUN_RACKS &&
    picked.every((f) => isRunType(f.type) && f.type === picked[0].type && f.runId === null);
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-ink">{ids.length} items selected</h2>
      <p className="text-sm text-ink-muted">Drag any of them to move them together.</p>
      <div className="flex flex-wrap gap-2">
        {canLink ? (
          <Button
            onClick={() => {
              dispatch({ type: "command", command: { type: "linkRun", ids: [...ids] } });
              dispatch({ type: "selectMore", on: false });
            }}
          >
            Link into run
          </Button>
        ) : null}
        <Button variant="secondary" onClick={() => dispatch({ type: "duplicate" })}>
          Duplicate
        </Button>
        <Button variant="danger" onClick={() => dispatch({ type: "delete" })}>
          Delete
        </Button>
      </div>
    </div>
  );
}
