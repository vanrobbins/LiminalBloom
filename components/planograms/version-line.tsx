// "Version 4 · published Oct 8 by Van", or "Not published".

import { formatMoment } from "@/lib/planograms/dates";
import type { PublishedVersion } from "@/lib/planograms/queries";

export function VersionLine({ latest }: { latest: Pick<PublishedVersion, "number" | "publishedAt" | "publishedByName"> | null }) {
  return (
    <p className="text-sm text-ink-muted">
      {latest ? `Version ${latest.number} · published ${formatMoment(latest.publishedAt)} by ${latest.publishedByName}` : "Not published"}
    </p>
  );
}
