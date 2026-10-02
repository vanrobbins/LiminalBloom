// A table's lower tables: one per side, four at most (DECISIONS 2026-09-30).

"use client";

import type { SessionAction } from "@/lib/layout/session";
import { SIDES, type Fixture } from "@/lib/layout/types";

type LowerTablesProps = { table: Fixture; lowers: Fixture[]; dispatch: (action: SessionAction) => void };

const WORD = { front: "front", back: "back", left: "left", right: "right" } as const;

export function LowerTables({ table, lowers, dispatch }: LowerTablesProps) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm text-ink">Lower tables</legend>
      <div className="grid grid-cols-4 gap-2">
        {SIDES.map((side) => {
          const lower = lowers.find((f) => f.setSide === side);
          return (
            <button
              key={side}
              type="button"
              aria-pressed={lower !== undefined}
              aria-label={`Lower table on the ${WORD[side]}`}
              onClick={() =>
                dispatch({
                  type: "command",
                  command: lower
                    ? { type: "delete", ids: [lower.id] }
                    : { type: "attachLowerTable", upperId: table.id, side },
                })
              }
              className="min-h-11 rounded border border-line bg-raised text-sm text-ink capitalize aria-pressed:bg-brand aria-pressed:text-on-brand"
            >
              {side}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
