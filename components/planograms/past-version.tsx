// A past version of a planogram, read-only, with the way back to the current one.

"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { PublishedVersion } from "@/lib/planograms/queries";

import { VersionLine } from "./version-line";

export function PastVersion({ fixtureId, latest, number, children }: { fixtureId: string; latest: PublishedVersion | null; number: number; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <VersionLine latest={latest} />
      <div className="flex flex-wrap items-center gap-3 rounded border border-line bg-raised px-4 py-3">
        <p className="text-ink">Version {number}, read-only.</p>
        <Button asChild variant="secondary">
          <Link href={`/planograms/${fixtureId}`}>Back to the current planogram</Link>
        </Button>
      </div>
      {children}
    </div>
  );
}
