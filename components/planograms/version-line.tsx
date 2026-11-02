// "Version 4 · published Oct 8, 3:05 PM by Van" (device time), or "Not published".

import { LocalTime } from "@/components/time/local-time";
import type { PublishedVersion } from "@/lib/planograms/queries";

export function VersionLine({ latest }: { latest: Pick<PublishedVersion, "number" | "publishedAt" | "publishedByName"> | null }) {
  return (
    <p className="text-sm text-ink-muted">
      {latest ? (
        <>
          Version {latest.number} · published <LocalTime at={latest.publishedAt} /> by {latest.publishedByName}
        </>
      ) : (
        "Not published"
      )}
    </p>
  );
}
