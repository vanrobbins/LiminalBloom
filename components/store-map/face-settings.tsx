// Which sides display product, and each side's grid (spec §5). A rack can
// switch sides on and off but always keeps one; other types have fixed sides.

"use client";

import { NumberStepper } from "@/components/ui/number-stepper";
import { FIXTURE_RULES } from "@/lib/layout/fixtures";
import { SIDE_LABEL } from "@/lib/layout/format";
import { MAX_GRID } from "@/lib/layout/limits";
import type { SessionAction } from "@/lib/layout/session";
import type { Face, Fixture } from "@/lib/layout/types";

type FaceSettingsProps = { fixture: Fixture; faces: Face[]; dispatch: (action: SessionAction) => void };

export function FaceSettings({ fixture, faces, dispatch }: FaceSettingsProps) {
  const rule = FIXTURE_RULES[fixture.type];
  const run = (command: Extract<SessionAction, { type: "command" }>["command"]) => dispatch({ type: "command", command });
  const choosable = rule.faces.length > 1;

  return (
    <div className="flex flex-col gap-3">
      {choosable ? (
        <fieldset>
          <legend className="mb-2 text-sm text-ink">Display sides</legend>
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
      {faces.map((face) => (
        <fieldset key={face.id} className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-ink">{SIDE_LABEL[face.side]} grid</legend>
          <NumberStepper
            label="Columns"
            value={face.columns}
            min={1}
            max={MAX_GRID}
            onChange={(columns) => run({ type: "setFaceGrid", faceId: face.id, columns, rows: face.rows })}
          />
          <NumberStepper
            label="Rows"
            value={face.rows}
            min={1}
            max={MAX_GRID}
            onChange={(rows) => run({ type: "setFaceGrid", faceId: face.id, columns: face.columns, rows })}
          />
        </fieldset>
      ))}
    </div>
  );
}
