// /company's Recent changes (spec 0.7.1 6.2): the latest changes to the company, newest first, one line each.
// Liminal Bloom's own actions about the company are in the list for the owner only (the read decides who).

import { LocalTime } from "@/components/time/local-time";
import { Card } from "@/components/ui/card";
import type { RecentChange } from "@/lib/companies/recent";

export function RecentSection({ changes }: { changes: RecentChange[] }) {
  return (
    <Card compact role="region" aria-labelledby="company-recent-heading">
      <h2 id="company-recent-heading" className="mb-3 text-lg font-semibold text-ink">
        Recent changes
      </h2>
      {changes.length === 0 ? (
        <p className="text-ink-muted">Nothing has changed yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line-subtle">
          {changes.map((change) => (
            <li key={change.id} className="flex flex-col gap-0.5 py-2">
              <span className="text-ink wrap-break-word">{change.text}</span>
              <span className="text-sm text-ink-muted">
                <LocalTime at={change.at} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
