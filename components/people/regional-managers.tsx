// The company's regional managers for this store's region, at the top of People (spec 0.7.1 6.6). Read-only
// here: company people change on /company. Names for everyone in the store; emails are sent only to someone
// with people.manage (the server decides, so a null email simply shows no address).

import type { RegionalManagerRow } from "@/lib/access/people-view";

export function RegionalManagers({ managers }: { managers: readonly RegionalManagerRow[] }) {
  if (managers.length === 0) return null;
  return (
    <section className="mb-6" aria-labelledby="regional-managers-heading">
      <h2 id="regional-managers-heading" className="mb-2 text-lg font-semibold text-ink">
        Regional Manager · {managers.length}
      </h2>
      <ul className="flex flex-col gap-px overflow-hidden rounded-lg border border-line-subtle bg-line-subtle">
        {managers.map((m, i) => (
          <li key={`${m.name}-${i}`} className="flex flex-col bg-raised px-4 py-3">
            <span className="font-medium text-ink wrap-break-word">
              {m.name}
              {m.isYou ? <span className="font-normal text-ink-muted"> (you)</span> : null}
            </span>
            {m.email ? <span className="text-sm text-ink-muted wrap-break-word">{m.email}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
