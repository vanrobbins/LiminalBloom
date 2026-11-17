// A frame rack's run (frame racks spec §4.3): add a rack at an open end or
// back to back behind it (run joins spec §1.2), take
// this rack out, and for a closed run choose where the combined grid starts.

"use client";

import { ArrowDown, ArrowLeft, ArrowRight, ListChecks, Plus, Unlink, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { openEnds, removalRefusal, runRacks } from "@/lib/layout/commands-runs";
import { MAX_RUN_RACKS, runShape, runWord } from "@/lib/layout/runs";
import type { SessionAction } from "@/lib/layout/session";
import type { Fixture, Layout } from "@/lib/layout/types";
import { FIELD_CLASSES } from "@/components/ui/password-field";
import { InfoPopover } from "@/components/ui/info-popover";

/** "+" and an arrow in one 44 px button: add a rack that way. */
const PlusArrow = ({ arrow: Arrow }: { arrow: LucideIcon }) => (
  <span aria-hidden="true" className="inline-flex items-center">
    <Plus strokeWidth={1.75} className="size-4" />
    <Arrow strokeWidth={1.75} className="size-4" />
  </span>
);

type RunControlsProps = { layout: Layout; rack: Fixture; dispatch: (action: SessionAction) => void };

export function RunControls({ layout, rack, dispatch }: RunControlsProps) {
  const ends = openEnds(layout, rack.id);
  const racks = rack.runId ? runRacks(layout, rack.runId) : [];
  const run = layout.frameRuns.find((r) => r.id === rack.runId);
  const closed = racks.length > 0 && runShape(racks.map((f) => ({ ...f, runIndex: f.runIndex ?? 0 }))).closed;
  const full = racks.length >= MAX_RUN_RACKS;
  const refusal = removalRefusal(layout, rack.id);
  const command = (c: Extract<SessionAction, { type: "command" }>["command"]) => dispatch({ type: "command", command: c });
  // Behind the right end when it's open, else the left. Only racks: a bay's back is against the wall.
  const behindSide = rack.type !== "frame_rack" ? null : ends.right ? "right" : ends.left ? "left" : null;
  const word = runWord(rack.type);

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm text-ink">
        <span className="inline-flex items-center gap-1">
          {rack.runId ? `Run of ${racks.length} ${word}s` : "Run"}
          <InfoPopover term="run" />
        </span>
      </legend>
      <div className="flex flex-wrap gap-2">
        <Button icon variant="secondary" disabled={!ends.left} onClick={() => command({ type: "addRackToRun", rackId: rack.id, side: "left" })} aria-label={`Add ${word} to the left`}>
          <PlusArrow arrow={ArrowLeft} />
        </Button>
        <Button icon variant="secondary" disabled={!ends.right} onClick={() => command({ type: "addRackToRun", rackId: rack.id, side: "right" })} aria-label={`Add ${word} to the right`}>
          <PlusArrow arrow={ArrowRight} />
        </Button>
        {rack.type === "frame_rack" ? (
          <Button
            icon
            variant="secondary"
            disabled={behindSide === null}
            onClick={() => behindSide && command({ type: "addRackToRun", rackId: rack.id, side: behindSide, behind: true })}
            aria-label="Add rack behind"
          >
            <PlusArrow arrow={ArrowDown} />
          </Button>
        ) : null}
      </div>
      {rack.runId === null ? (
        // Shift-click does this with a keyboard; a phone has this and a long-press.
        <Button icon variant="secondary" className="md:hidden" onClick={() => dispatch({ type: "selectMore", on: true })} aria-label="Select more">
          <ListChecks aria-hidden="true" strokeWidth={1.75} className="size-5" />
        </Button>
      ) : null}
      {full ? <p className="text-sm text-ink-muted">A run holds up to {MAX_RUN_RACKS} {word}s.</p> : null}
      {rack.runId ? (
        <>
          <Button icon variant="secondary" disabled={refusal !== null} onClick={() => command({ type: "removeFromRun", rackId: rack.id })} aria-label="Remove from run">
            <Unlink aria-hidden="true" strokeWidth={1.75} className="size-5" />
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
