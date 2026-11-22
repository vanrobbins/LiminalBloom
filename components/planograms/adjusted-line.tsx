// The Quick Adjust lines on a planogram (0.7.0.9 spec §4.4, §4.5): the published one ("Quick Adjust · since Nov 17 ·
// Van") with Compare for everyone, Edit for those who may draft and Revert for those who may publish; and a draft one
// waiting ("Quick Adjust draft · Sam · Nov 17") with Open, which is how a publisher finds a VM Worker's draft.
// Controls are hidden by switch as a courtesy; the server checks each again.

"use client";

import { Zap } from "lucide-react";
import Link from "next/link";

import { CompareButton } from "@/components/quick-adjust/compare-button";
import { LocalTime } from "@/components/time/local-time";
import { Button } from "@/components/ui/button";
import { InfoPopover } from "@/components/ui/info-popover";
import { can, type Holder } from "@/lib/access/can";
import type { Adjustments } from "@/lib/planograms/adjust";
import { revertWords } from "@/lib/planograms/adjust-words";
import type { PlanogramScope, ProductLook, SnapshotEntry } from "@/lib/planograms/types";

import { RevertAdjustment } from "./revert-adjustment";

type AdjustmentLinesProps = {
  fixtureId: string;
  /** Compare draws the faces of this fixture. */
  scope: PlanogramScope;
  adjustments: Adjustments;
  /** The version the floor sits on, as published: its tiles name what a revert puts back. */
  version: { number: number; placements: readonly SnapshotEntry[] };
  looks: Readonly<Record<string, ProductLook>>;
  member: Holder;
};

export function AdjustmentLines({ fixtureId, scope, adjustments, version, looks, member }: AdjustmentLinesProps) {
  const { draft, published } = adjustments;
  const canDraft = can(member, "planograms.draft");
  const canPublish = can(member, "planograms.publish");
  const adjustHref = `/planograms/${fixtureId}/adjust`;
  if (!published && !(draft && (canDraft || canPublish))) return null;
  return (
    <div className="flex flex-col gap-1">
      {published ? (
        <div data-adjustment="published" className="flex flex-wrap items-center gap-x-2 text-sm text-ink-muted">
          <p>
            Quick Adjust · since {published.publishedAt ? <LocalTime at={published.publishedAt} /> : null} · {published.publishedByName}
          </p>
          <InfoPopover term="quickAdjust" />
          <span className="flex items-center gap-2">
            <CompareButton fixtureId={fixtureId} scope={scope} which="published" />
            {canDraft ? (
              <Button asChild variant="secondary" icon>
                <Link href={adjustHref} aria-label="Edit Quick Adjust">
                  <Zap aria-hidden="true" strokeWidth={1.75} className="size-5" />
                </Link>
              </Button>
            ) : null}
            {canPublish ? <RevertAdjustment fixtureId={fixtureId} adjustmentId={published.id} number={version.number} words={revertWords(published, version.placements, looks)} /> : null}
          </span>
        </div>
      ) : null}
      {draft && (canDraft || canPublish) ? (
        <div data-adjustment="draft" className="flex flex-wrap items-center gap-x-2 text-sm text-ink-muted">
          <p>
            Quick Adjust draft · {draft.createdByName} · <LocalTime at={draft.createdAt} />
          </p>
          {canDraft ? (
            <Button asChild variant="secondary" icon>
              <Link href={adjustHref} aria-label="Open Quick Adjust draft">
                <Zap aria-hidden="true" strokeWidth={1.75} className="size-5" />
              </Link>
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
