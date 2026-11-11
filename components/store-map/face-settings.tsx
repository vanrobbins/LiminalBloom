// Which sides display product, and each side's grid (spec §5). A rack can
// switch sides on and off but always keeps one; other types have fixed sides.
// The grids follow the fixture's size by themselves, so they sit folded behind
// one line that says what they are (DECISIONS 11-11).

"use client";

import { Fold } from "@/components/ui/fold";
import { NumberStepper } from "@/components/ui/number-stepper";
import { Button } from "@/components/ui/button";
import { autoGrid, isAutoGrid } from "@/lib/layout/fixture-grids";
import { FIXTURE_RULES } from "@/lib/layout/fixtures";
import { SIDE_LABEL } from "@/lib/layout/format";
import { feetText } from "@/lib/feet";
import { MAX_GRID_COLUMNS, MAX_GRID_ROWS } from "@/lib/layout/limits";
import type { SessionAction } from "@/lib/layout/session";
import type { Face, Fixture } from "@/lib/layout/types";
import { InfoPopover } from "@/components/ui/info-popover";

import { usePanelFold } from "./use-panel-fold";

type FaceSettingsProps = { fixture: Fixture; faces: Face[]; dispatch: (action: SessionAction) => void };

/** What the folded grids say: one side's size, or how many sides there are. */
function gridSummary(fixture: Fixture, faces: Face[]): string {
  if (faces.length !== 1) return `${faces.length} sides`;
  const [{ columns, rows }] = faces;
  if (fixture.type === "frame_rack") return `${feetText(columns)} ft rail`;
  return `${feetText(columns)} ft × ${rows} ${rows === 1 ? "row" : "rows"}`;
}

export function FaceSettings({ fixture, faces, dispatch }: FaceSettingsProps) {
  const rule = FIXTURE_RULES[fixture.type];
  const run = (command: Extract<SessionAction, { type: "command" }>["command"]) => dispatch({ type: "command", command });
  const choosable = rule.faces.length > 1;
  const fold = usePanelFold("grid", faces.some((face) => !isAutoGrid(fixture, face)));

  return (
    <div className="flex flex-col gap-3">
      {choosable ? (
        <fieldset>
          <legend className="mb-2 text-sm text-ink">
            <span className="inline-flex items-center gap-1">
              Display sides
              <InfoPopover term="face" />
            </span>
          </legend>
          <div className="grid grid-cols-4 gap-2">
            {rule.faces.map((side) => {
              const on = faces.some((face) => face.side === side);
              return (
                <button
                  key={side}
                  type="button"
                  aria-pressed={on}
                  disabled={on && faces.length === 1}
                  onClick={() => run({ type: "setFace", fixtureId: fixture.id, side, on: !on })}
                  className="min-h-11 rounded border border-line bg-raised text-sm text-ink disabled:opacity-60 aria-pressed:bg-brand aria-pressed:text-on-brand"
                >
                  {SIDE_LABEL[side]}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}
      <Fold title="Planogram grid" summary={gridSummary(fixture, faces)} open={fold.open} onToggle={fold.toggle}>
        {faces.map((face) => (
          <fieldset key={face.id} className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-ink">{SIDE_LABEL[face.side]} grid</legend>
            <NumberStepper
              label="Width"
              value={face.columns}
              min={1}
              max={MAX_GRID_COLUMNS}
              format={(columns) => `${feetText(columns)} ft`}
              onChange={(columns) => run({ type: "setFaceGrid", faceId: face.id, columns, rows: face.rows })}
            />
            {fixture.type === "frame_rack" ? (
              // One rail, so one row (frame racks spec §2).
              <p className="inline-flex items-center gap-1 text-sm text-ink">
                1 rail
                <InfoPopover term="frameRack" />
              </p>
            ) : (
              <NumberStepper
                label="Rows"
                value={face.rows}
                min={1}
                max={MAX_GRID_ROWS}
                onChange={(rows) => run({ type: "setFaceGrid", faceId: face.id, columns: face.columns, rows })}
              />
            )}
            {isAutoGrid(fixture, face) ? null : (
              <Button variant="secondary" onClick={() => run({ type: "setFaceGrid", faceId: face.id, ...autoGrid(fixture, face.side) })}>
                Fit to fixture ({feetText(autoGrid(fixture, face.side).columns)} ft × {autoGrid(fixture, face.side).rows})
              </Button>
            )}
          </fieldset>
        ))}
      </Fold>
    </div>
  );
}
