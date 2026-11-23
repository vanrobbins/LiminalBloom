// The company request queue (spec 0.7.1 7.3): Pending (oldest first, the one waiting longest on top), then the
// decided ones. Each row opens the request with the company asked for, who asked, its status and when.

import { Ban, CircleCheck, Clock, Undo2, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { LocalTime } from "@/components/time/local-time";
import type { AdminRequestItem } from "@/lib/admin/request-reads";
import type { RequestStatus } from "@/lib/companies/request-rules";

const LINK = "flex min-h-11 flex-col gap-1 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

const STATUS: Record<RequestStatus, { label: string; icon: LucideIcon }> = {
  pending: { label: "Waiting", icon: Clock },
  approved: { label: "Approved", icon: CircleCheck },
  rejected: { label: "Rejected", icon: Ban },
  withdrawn: { label: "Withdrawn", icon: Undo2 },
};

/** A request's status in words and an icon, never colour alone. */
export function RequestStatusWord({ status }: { status: RequestStatus }) {
  const { label, icon: Icon } = STATUS[status];
  return (
    <span data-request-status={status} className="inline-flex items-center gap-1 text-sm text-ink-muted">
      <Icon aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" />
      {label}
    </span>
  );
}

function Section({ id, title, items, empty }: { id: string; title: string; items: AdminRequestItem[]; empty: string }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className="text-lg font-semibold text-ink">
        {title} <span className="font-normal text-ink-muted tabular-nums">({items.length})</span>
      </h2>
      {items.length === 0 ? (
        <p className="text-ink-muted">{empty}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line-subtle">
          {items.map((item) => (
            <li key={item.id}>
              <Link href={`/admin/requests/${item.id}`} className={LINK}>
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-medium text-ink wrap-break-word">{item.name}</span>
                  <RequestStatusWord status={item.status} />
                </span>
                <span className="text-ink wrap-break-word">{item.requesterName}</span>
                <span className="text-sm text-ink-muted">
                  <LocalTime at={item.status === "pending" ? item.createdAt : item.decidedAt} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function RequestList({ pending, decided }: { pending: AdminRequestItem[]; decided: AdminRequestItem[] }) {
  return (
    <>
      <Section id="pending" title="Waiting" items={pending} empty="No company requests are waiting." />
      <Section id="decided" title="Decided" items={decided} empty="Nothing decided yet." />
    </>
  );
}
