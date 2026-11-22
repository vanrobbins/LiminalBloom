// Card 6, "Recent changes" (0.7.0.6 spec section 4): the latest access events, five lines, newest
// first. Each line is worded on the server by `activityText`, which leaves an email out unless the
// viewer may manage people; the card prints the text as given and never adds to it.

import { History } from "lucide-react";

import { LocalTime } from "@/components/time/local-time";
import type { ChangeRow } from "@/lib/home/types";

import { HomeCard } from "./home-card";

const SHOWN = 5;

export function RecentChangesCard({ rows }: { rows: ChangeRow[] }) {
  return (
    <HomeCard title="Recent changes" icon={History} seeAll={{ href: "/roles", page: "roles", more: Math.max(0, rows.length - SHOWN) }}>
      <ul className="flex flex-col divide-y divide-line-subtle">
        {rows.slice(0, SHOWN).map((row) => (
          <li key={row.id} className="min-h-11 py-2 text-sm text-ink wrap-break-word">
            {row.text}{" "}
            <span className="text-ink-muted">
              · <LocalTime at={row.at} />
            </span>
          </li>
        ))}
      </ul>
    </HomeCard>
  );
}
