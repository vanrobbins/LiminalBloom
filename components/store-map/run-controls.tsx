// A frame rack's run (frame racks spec §4.3): add a rack at an open end or
// back to back behind it (run joins spec §1.2), take
// this rack out, and for a closed run choose where the combined grid starts.

"use client";

import { Button } from "@/components/ui/button";
import { openEnds, removalRefusal, runRacks } from "@/lib/layout/commands-runs";
import { MAX_RUN_RACKS, runShape } from "@/lib/layout/runs";
import type { SessionAction } from "@/lib/layout/session";
import type { Fixture, Layout } from "@/lib/layout/types";
import { FIELD_CLASSES } from "@/components/ui/password-field";
import { InfoPopover } from "@/components/ui/info-popover";

type RunControlsProps = { layout: Layout; rack: Fixture; dispatch: (action: SessionAction) => void };

export function RunControls({ layout, rack, dispatch }: RunControlsProps) {
  const ends = openEnds(layout, rack.id);
  const racks = rack.runId ? runRacks(layout, rack.runId) : [];
  const run = layout.frameRuns.find((r) => r.id === rack.runId);
  const closed = racks.length > 0 && runShape(racks.map((f) => ({ ...f, runIndex: f.runIndex ?? 0 }))).closed;
  const full = racks.length >= MAX_RUN_RACKS;
  const refusal = removalRefusal(layout, rack.id);
  const command = (c: Extract<SessionAction, { type: "command" }>["command"]) => dispatch({ type: "command", command: c });
  // Behind the right end when it's open, else the left.
  const behindSide = ends.right ? "right" : ends.left ? "left" : null;

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm text-ink">
        <span className="inline-flex items-center gap-1">
          {rack.runId ? `Run of ${racks.length} racks` : "Run"}
          <InfoPopover term="run" />
        </span>
      </legend>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" disabled={!ends.left} onClick={() => command({ type: "addRackToRun", rackId: rack.id, side: "left" })}>
          Add rack to the left
        </Button>
        <Button variant="secondary" disabled={!ends.right} onClick={() => command({ type: "addRackToRun", rackId: rack.id, side: "right" })}>
          Add rack to the right
        </Button>
        <Button
          variant="secondary"
          className="col-span-2"
          disabled={behindSide === null}
          onClick={() => behindSide && command({ type: "addRackToRun", rackId: rack.id, side: behindSide, behind: true })}
        >
          Add rack behind
        </Button>
      </div>
      {rack.runId === null ? (
        // Shift-click does this with a keyboard; a phone has this and a long-press.
        <Button variant="secondary" className="md:hidden" onClick={() => dispatch({ type: "selectMore", on: true })}>
          Select more
        </Button>
      ) : null}
      {full ? <p className="text-sm text-ink-muted">A run holds up to {MAX_RUN_RACKS} racks.</p> : null}
      {rack.runId ? (
        <>
          <Button variant="secondary" disabled={refusal !== null} onClick={() => command({ type: "removeFromRun", rackId: rack.id })}>
            Remove from run
          </Button>
          {refusal ? <p className="text-sm text-ink-muted">{refusal}</p> : null}
        </>
      ) : null}
      {closed && run ? (
        <label className="flex flex-col gap-1 text-sm text-ink">
          Start reading at
          <select
            value={run.startIndex}
            onChange={(event) => command({ type: "setRunStart", runId: run.id, startIndex: Number(event.target.value) })}
            className={FIELD_CLASSES}
          >
            {racks.map((f, i) => (
              <option key={f.id} value={i}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </fieldset>
  );
}
