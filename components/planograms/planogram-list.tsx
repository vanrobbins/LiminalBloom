// The planogram list (spec §5.1): fixtures by zone, each zone folded behind an
// arrow with a one-line summary of what needs doing (A1, UX audit U18); each
// fixture with its published version, a Draft chip and its due date. The type
// shows only when the name doesn't already say it (U10).

"use client";

import Link from "next/link";

import { LocalTime } from "@/components/time/local-time";
import { useOpenGroups } from "@/components/ui/use-open-groups";
import { ZoneFold } from "@/components/ui/zone-fold";
import { dueLabel } from "@/lib/planograms/dates";
import type { ListGroup, ListItem } from "@/lib/planograms/list";
import { typeHint } from "@/lib/natural-sort";

import { DueBadge } from "./due-badge";

const NO_ZONE = "none";

/** "2 drafts · 1 overdue · 3 not published", or "All published". */
export function zoneSummary(items: readonly ListItem[], today: string): string {
  const drafts = items.filter((i) => i.hasDraft).length;
  const overdue = items.filter((i) => i.dueDate && dueLabel(i.dueDate, today).overdue).length;
  const unpublished = items.filter((i) => !i.publishedVersion).length;
  const parts = [
    drafts ? `${drafts} ${drafts === 1 ? "draft" : "drafts"}` : null,
    overdue ? `${overdue} overdue` : null,
    unpublished ? `${unpublished} not published` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "All published";
}

export function PlanogramList({ groups, today, storeKey }: { groups: ListGroup[]; today: string; storeKey: string }) {
  const { isOpen, toggle, canFold } = useOpenGroups({ storeKey, groupIds: groups.map((g) => g.zoneId ?? NO_ZONE) });
  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => {
        const id = group.zoneId ?? NO_ZONE;
        return (
          <ZoneFold
            key={id}
            title={group.zoneName}
            count={group.items.length}
            summary={zoneSummary(group.items, today)}
            open={isOpen(id)}
            canFold={canFold}
            onToggle={() => toggle(id)}
          >
            <ul className="mt-1 flex flex-col divide-y divide-line-subtle rounded-lg border border-line-subtle bg-raised">
              {group.items.map((item) => {
                const type = typeHint(item.name, item.typeLabel);
                return (
                  <li key={item.fixtureId}>
                    <Link href={`/planograms/${item.fixtureId}`} className="flex min-h-11 flex-col gap-1 px-4 py-3 md:flex-row md:items-center md:justify-between">
                      <span className="flex flex-col">
                        <span className="font-medium text-ink wrap-anywhere">{item.name}</span>
                        {type ? <span className="text-sm text-ink-muted">{type}</span> : null}
                      </span>
                      <span className="flex flex-wrap items-center gap-2 text-sm">
                        {item.publishedVersion && item.publishedAt ? (
                          <span className="text-ink-muted">
                            Version {item.publishedVersion} · <LocalTime at={item.publishedAt} />
                          </span>
                        ) : (
                          <span className="rounded border border-dashed border-line px-2 text-ink-muted">Not published</span>
                        )}
                        {item.hasDraft ? <span className="rounded border border-line px-2 text-ink">Draft</span> : null}
                        {item.dueDate ? <DueBadge dueDate={item.dueDate} today={today} /> : null}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </ZoneFold>
        );
      })}
    </div>
  );
}
