// Fit to corner (run joins spec §3.2): a wall bay across a corner between two
// other bays bends into the quarter circle between them, in one tap. It
// doesn't link them: that stays an explicit choice (DECISIONS 11-09).

"use client";

import { Button } from "@/components/ui/button";
import { cornerFit } from "@/lib/layout/curve-snap";
import { formatLength } from "@/lib/layout/format";
import type { SessionAction } from "@/lib/layout/session";
import type { Fixture, Layout } from "@/lib/layout/types";

type CornerFitProps = { layout: Layout; fixture: Fixture; dispatch: (action: SessionAction) => void };

export function CornerFit({ layout, fixture, dispatch }: CornerFitProps) {
  const fit = cornerFit(layout, fixture.id);
  if (!fit) return null;
  if ("refusal" in fit) return <p className="text-sm text-ink-muted">{fit.refusal}</p>;
  return (
    <div className="flex flex-col gap-1">
      <Button variant="secondary" onClick={() => dispatch({ type: "command", command: { type: "updateFixture", id: fixture.id, changes: fit.changes } })}>
        Fit to corner
      </Button>
      {fit.gap > 1 ? (
        <p className="text-sm text-ink-muted">
          Bends between the two bays; it stops {formatLength(fit.gap)} short of the farther one.
        </p>
      ) : null}
    </div>
  );
}
