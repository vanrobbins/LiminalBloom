// Card 2, "Planograms to finish" (0.7.0.6 spec section 4): planograms with a draft or a due date,
// in the order `planogramWork` gave. Rows link to the planogram; a row's link name carries its
// state and due date, so a screen reader hears what the eyes see.

import { LayoutPanelTop } from "lucide-react";
import Link from "next/link";

import { DueBadge } from "@/components/planograms/due-badge";
import { typeHint } from "@/lib/natural-sort";
import { dueLabel } from "@/lib/planograms/dates";
import type { PlanogramWork, PlanogramWorkRow } from "@/lib/home/types";

import { HomeCard } from "./home-card";

/** The state word the /planograms list uses; a draft is the work, so it wins over the published version, and a Quick Adjust draft over the version it adjusts. */
function stateWord(row: PlanogramWorkRow): string {
  if (row.hasDraft) return "Draft";
  if (row.adjustment === "draft") return "Adjusting";
  return row.publishedVersion ? `Version ${row.publishedVersion}` : "Not published";
}

export function PlanogramWorkCard({ work }: { work: PlanogramWork }) {
  return (
    <HomeCard title="Planograms to finish" icon={LayoutPanelTop} seeAll={{ href: "/planograms", page: "planograms", more: work.total - work.rows.length }} className="md:col-span-2">
      <ul className="flex flex-col divide-y divide-line-subtle">
        {work.rows.map((row) => {
          const type = typeHint(row.name, row.typeLabel);
          // A Quick Adjust draft alone opens the adjust page; with a monthly draft too the row keeps the planogram (its page lines reach the adjustment).
          const adjustOnly = row.adjustment === "draft" && !row.hasDraft;
          const alsoAdjusting = row.adjustment === "draft" && row.hasDraft;
          const label = [row.name, type, stateWord(row), alsoAdjusting ? "Adjusting" : null, row.dueDate ? dueLabel(row.dueDate, work.today).text : null].filter(Boolean).join(", ");
          return (
            <li key={row.fixtureId}>
              <Link href={`/planograms/${row.fixtureId}${adjustOnly ? "/adjust" : ""}`} aria-label={label} className="flex min-h-11 flex-col gap-1 py-2 md:flex-row md:items-center md:justify-between">
                <span className="flex flex-col">
                  <span className="font-medium text-ink wrap-break-word">{row.name}</span>
                  {type ? <span className="text-sm text-ink-muted">{type}</span> : null}
                </span>
                <span className="flex flex-wrap items-center gap-2 text-sm">
                  {row.hasDraft || adjustOnly ? <span className="rounded border border-line px-2 text-ink">{stateWord(row)}</span> : <span className="text-ink-muted">{stateWord(row)}</span>}
                  {alsoAdjusting ? <span className="rounded border border-line px-2 text-ink">Adjusting</span> : null}
                  {row.dueDate ? <DueBadge dueDate={row.dueDate} today={work.today} /> : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </HomeCard>
  );
}
