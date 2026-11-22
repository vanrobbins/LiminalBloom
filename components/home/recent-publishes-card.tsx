// Card 5, "Recently published" (0.7.0.6 spec section 4): the store's latest publishes, newest
// first as the query gave them, at most five. Each row opens its planogram; the moment is in the
// viewer's own time zone (`LocalTime`).

import { Send } from "lucide-react";
import Link from "next/link";

import { LocalTime } from "@/components/time/local-time";
import type { PublishRow } from "@/lib/home/types";

import { HomeCard } from "./home-card";

const SHOWN = 5;

export function RecentPublishesCard({ rows }: { rows: PublishRow[] }) {
  return (
    <HomeCard title="Recently published" icon={Send}>
      <ul className="flex flex-col divide-y divide-line-subtle">
        {rows.slice(0, SHOWN).map((row) => (
          <li key={`${row.fixtureId}-${row.version}`}>
            <Link href={`/planograms/${row.fixtureId}`} aria-label={`${row.fixtureName}, Version ${row.version}, published by ${row.publisherName}`} className="flex min-h-11 flex-col justify-center py-2">
              <span className="font-medium text-ink wrap-break-word">{row.fixtureName}</span>
              <span className="text-sm text-ink-muted">
                Version {row.version} · {row.publisherName} · <LocalTime at={row.publishedAt} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </HomeCard>
  );
}
