// The help queue (spec 0.7.1 7.3, 9.2): Open (oldest first, the one waiting longest on top), Replied and Closed.
// Each row opens the thread with who asked, what about, the first line and when. Plain text only.

import Link from "next/link";

import { HelpStatusWord } from "@/components/help/help-status";
import { LocalTime } from "@/components/time/local-time";
import type { AdminHelpItem } from "@/lib/admin/help-reads";
import { KIND_LABEL } from "@/lib/help/kinds";

const LINK = "flex min-h-11 flex-col gap-1 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

function Section({ id, title, items, empty }: { id: string; title: string; items: AdminHelpItem[]; empty: string }) {
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
              <Link href={`/admin/help/${item.id}`} className={LINK}>
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-medium text-ink wrap-break-word">{item.requesterName}</span>
                  <span className="text-sm text-ink-muted">{KIND_LABEL[item.kind]}</span>
                  <HelpStatusWord status={item.status} />
                </span>
                <span className="truncate text-ink">{item.firstLine}</span>
                <span className="text-sm text-ink-muted">
                  <LocalTime at={item.createdAt} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function HelpQueue({ open, replied, closed }: { open: AdminHelpItem[]; replied: AdminHelpItem[]; closed: AdminHelpItem[] }) {
  return (
    <>
      <Section id="open" title="Open" items={open} empty="Nobody is waiting for an answer." />
      <Section id="replied" title="Replied" items={replied} empty="No replied requests." />
      <Section id="closed" title="Closed" items={closed} empty="No closed requests." />
    </>
  );
}
