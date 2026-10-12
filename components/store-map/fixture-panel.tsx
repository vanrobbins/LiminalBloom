// What the read-only map shows about a tapped fixture (spec §5): a one-line
// summary, then its published planogram (what's on the floor now), and a way
// to edit it. A lower table shows its set's planogram.

"use client";

import Link from "next/link";

import { PlanogramPreview } from "@/components/planograms/planogram-preview";
import { Button } from "@/components/ui/button";
import { FIXTURE_RULES } from "@/lib/layout/fixtures";
import { formatLength } from "@/lib/layout/format";
import type { Layout } from "@/lib/layout/types";
import { formatDay } from "@/lib/planograms/dates";
import { planogramOwner, planogramScope } from "@/lib/planograms/faces";
import type { FloorPlanogram, ProductLook } from "@/lib/planograms/types";

type FixturePanelProps = { layout: Layout; fixtureId: string; planograms: Readonly<Record<string, FloorPlanogram>>; looks: Readonly<Record<string, ProductLook>> };

export function FixturePanel({ layout, fixtureId, planograms, looks }: FixturePanelProps) {
  const fixture = layout.fixtures.find((f) => f.id === fixtureId);
  if (!fixture) return null;
  const zone = layout.zones.find((z) => z.id === fixture.zoneId);
  const owner = planogramOwner(layout, fixtureId);
  const scope = owner ? planogramScope(layout, owner.id) : null;
  const floor = owner ? planograms[owner.id] : undefined;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-muted">
        {FIXTURE_RULES[fixture.type].label} · {formatLength(fixture.width)} × {formatLength(fixture.depth)} · {zone?.name ?? "Store floor"}
      </p>
      {owner && scope && scope.faces.length > 0 ? (
        <>
          {floor?.hasDraft ? (
            <p className="text-sm text-ink">
              Draft in progress{floor.dueDate ? ` · due ${formatDay(floor.dueDate)}` : ""}
            </p>
          ) : null}
          {floor?.latest ? <PlanogramPreview key={owner.id} scope={scope} entries={floor.latest.placements} looks={looks} /> : <p className="text-ink">No planogram yet</p>}
          <Button asChild className="self-start">
            <Link href={`/planograms/${owner.id}`}>Edit planogram</Link>
          </Button>
        </>
      ) : null}
    </div>
  );
}
