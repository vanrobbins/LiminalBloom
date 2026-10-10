// Version history (spec §5.5), newest first.

"use client";

import Link from "next/link";

import { formatMoment } from "@/lib/planograms/dates";

import { RestoreButton } from "./restore-button";

export type HistoryEntry = {
  number: number;
  publishedAt: Date;
  publishedByName: string;
  summary: string | null;
  changeText: string;
  gone: { label: string; count: number }[];
};

export function HistoryList({ fixtureId, expectedVersion, entries }: { fixtureId: string; expectedVersion: number; entries: HistoryEntry[] }) {
  return (
    <ol className="flex flex-col gap-4">
      {entries.map((e) => (
        <li key={e.number}>
          <article className="flex flex-col gap-2 rounded-lg border border-line-subtle bg-raised p-4">
            <h2 className="text-lg font-semibold text-ink">Version {e.number}</h2>
            <p className="text-sm text-ink-muted">{`${formatMoment(e.publishedAt)} · ${e.publishedByName}`}</p>
            {e.summary ? <p className="text-ink">{e.summary}</p> : null}
            <p className="text-sm text-ink">{e.changeText}</p>
            {e.gone.map((g) => (
              <p key={g.label} className="text-sm text-ink-muted">{`${g.label} is no longer on this fixture (${g.count} ${g.count === 1 ? "product" : "products"}).`}</p>
            ))}
            <div className="flex flex-wrap gap-3">
              <Link href={`/planograms/${fixtureId}?version=${e.number}`} aria-label={`View version ${e.number}`} className="inline-flex min-h-11 items-center text-brand-strong underline underline-offset-4">
                View
              </Link>
              <RestoreButton fixtureId={fixtureId} expectedVersion={expectedVersion} number={e.number} />
            </div>
          </article>
        </li>
      ))}
    </ol>
  );
}
