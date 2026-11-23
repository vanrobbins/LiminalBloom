// A store's people and waiting invitations, on /admin/stores/[id]: names, emails, roles, dates. Never its data.

import Link from "next/link";

import { LocalTime } from "@/components/time/local-time";
import type { StoreDetail } from "@/lib/admin/reads";

export function StorePeople({ store }: { store: StoreDetail }) {
  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="people" className="flex flex-col gap-2">
        <h2 id="people" className="text-lg font-semibold text-ink">People</h2>
        {store.people.length === 0 ? (
          <p className="text-ink-muted">Nobody is in this store.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line-subtle">
            {store.people.map((p) => (
              <li key={p.userId} className="flex flex-col gap-0.5 py-2">
                <p className="wrap-break-word text-ink">
                  {p.name} <span className="text-ink-muted">{p.roleName ?? "No role"}</span>
                </p>
                <Link
                  href={`/admin/people?email=${encodeURIComponent(p.email)}`}
                  className="inline-flex min-h-11 items-center self-start text-sm break-all text-ink-muted underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  {p.email}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="invitations" className="flex flex-col gap-2">
        <h2 id="invitations" className="text-lg font-semibold text-ink">Invitations waiting</h2>
        {store.invitations.length === 0 ? (
          <p className="text-ink-muted">None.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line-subtle">
            {store.invitations.map((i) => (
              <li key={i.id} className="flex flex-col gap-0.5 py-2">
                <p className="break-all text-ink">
                  {i.email} <span className="text-ink-muted">as {i.roleName ?? "no role"}</span>
                </p>
                <p className="text-sm text-ink-muted">
                  {i.expired ? "Expired " : "Expires "}
                  <LocalTime at={i.expiresAt} />
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
