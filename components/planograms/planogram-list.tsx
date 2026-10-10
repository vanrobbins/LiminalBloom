// The planogram list (spec §5.1): fixtures by zone, each with its published
// version, a Draft badge and its due date.

import Link from "next/link";

import { formatMoment } from "@/lib/planograms/dates";
import type { ListGroup } from "@/lib/planograms/list";

import { DueBadge } from "./due-badge";

export function PlanogramList({ groups, today }: { groups: ListGroup[]; today: string }) {
  return (
    <div className="flex flex-col gap-8">
      {groups.map((group, index) => (
        <section key={group.zoneName} aria-labelledby={`zone-${index}`} className="flex flex-col gap-2">
          <h2 id={`zone-${index}`} className="text-sm font-medium text-ink-muted">
            {group.zoneName}
          </h2>
          <ul className="flex flex-col divide-y divide-line-subtle rounded-lg border border-line-subtle bg-raised">
            {group.items.map((item) => (
              <li key={item.fixtureId}>
                <Link href={`/planograms/${item.fixtureId}`} className="flex min-h-11 flex-col gap-1 px-4 py-3 md:flex-row md:items-center md:justify-between">
                  <span className="flex flex-col">
                    <span className="font-medium text-ink wrap-anywhere">{item.name}</span>
                    <span className="text-sm text-ink-muted">{item.typeLabel}</span>
                  </span>
                  <span className="flex flex-wrap items-center gap-3 text-sm">
                    <span className="text-ink-muted">
                      {item.publishedVersion && item.publishedAt
                        ? `Version ${item.publishedVersion} · ${formatMoment(item.publishedAt)}`
                        : "Not published"}
                    </span>
                    {item.hasDraft ? <span className="rounded border border-line px-2 text-ink">Draft</span> : null}
                    {item.dueDate ? <DueBadge dueDate={item.dueDate} today={today} /> : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
