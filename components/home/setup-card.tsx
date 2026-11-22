// Card 1, "Set up the store" (0.7.0.6 spec section 4): one linked row for each step still missing.
// `setupSteps` already chose the rows for this viewer's switches; the card only draws them.

import { ListChecks } from "lucide-react";
import Link from "next/link";

import type { SetupRow } from "@/lib/home/types";

import { HomeCard } from "./home-card";

export function SetupCard({ rows }: { rows: SetupRow[] }) {
  return (
    <HomeCard title="Set up the store" icon={ListChecks}>
      <ul className="flex flex-col divide-y divide-line-subtle">
        {rows.map((row) => (
          <li key={row.key}>
            <Link href={row.href} className="flex min-h-11 items-center py-2 text-ink wrap-break-word">
              {row.label}
            </Link>
          </li>
        ))}
      </ul>
    </HomeCard>
  );
}
