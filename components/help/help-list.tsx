// My requests (spec 0.7.1 9.2): newest first, each row a link to its thread with the kind, the first line and the
// status in words and an icon. A dot on "Replied" until the thread has been opened. Empty, it says so and leaves
// the page's call to action to ask.

import Link from "next/link";

import { LocalTime } from "@/components/time/local-time";
import { KIND_LABEL } from "@/lib/help/kinds";
import type { HelpListItem } from "@/lib/help/queries";

import { HelpStatusWord } from "./help-status";

export function HelpList({ items }: { items: HelpListItem[] }) {
  if (items.length === 0) {
    return <p className="text-ink-muted">You haven&apos;t asked Liminal Bloom for help yet.</p>;
  }
  return (
    <ul className="flex flex-col divide-y divide-line-subtle rounded-lg border border-line-subtle bg-raised">
      {items.map((item) => (
        <li key={item.id}>
          <Link href={`/help/${item.id}`} className="flex min-h-11 flex-col gap-1 p-4 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink">
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-sm text-ink-muted">{KIND_LABEL[item.kind]}</span>
              <HelpStatusWord status={item.status} />
              {item.unread ? (
                <span data-help-unread className="inline-flex items-center gap-1 text-sm text-info">
                  <span aria-hidden="true" className="size-2 rounded-full bg-info" />
                  New reply
                </span>
              ) : null}
            </span>
            <span className="truncate text-ink">{item.firstLine}</span>
            <span className="text-sm text-ink-muted">
              <LocalTime at={item.createdAt} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
