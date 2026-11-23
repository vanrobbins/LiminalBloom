// Every store, for /admin/stores (spec 0.7.1 7.3): name, created, people, Store Managers, paused.
// Rows on a phone and tablet, a table from 1024 px; either way the name opens the store.

import Link from "next/link";

import { PausedBadge } from "@/components/admin/paused-badge";
import { LocalTime } from "@/components/time/local-time";
import type { StoreRow } from "@/lib/admin/reads";

const LINK = "text-ink underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
const managers = (s: StoreRow) => (s.managers.length > 0 ? s.managers.join(", ") : "No Store Manager");
const peopleCount = (s: StoreRow) => `${s.people} ${s.people === 1 ? "person" : "people"}`;

export function StoreList({ stores }: { stores: StoreRow[] }) {
  if (stores.length === 0) return <p className="text-ink-muted">There are no stores yet.</p>;
  return (
    <>
      <ul className="flex flex-col divide-y divide-line-subtle lg:hidden">
        {stores.map((s) => (
          <li key={s.id} className="flex flex-col gap-1 py-3">
            <div className="flex items-center gap-2">
              <Link href={`/admin/stores/${s.id}`} className={`min-h-11 min-w-0 flex-1 content-center font-medium wrap-break-word ${LINK}`}>
                {s.name}
              </Link>
              {s.paused ? <PausedBadge /> : null}
            </div>
            <p className="text-sm text-ink-muted">
              {peopleCount(s)} · {managers(s)}
            </p>
            <p className="text-sm text-ink-muted">
              Created <LocalTime at={s.createdAt} />
            </p>
          </li>
        ))}
      </ul>
      <table className="hidden w-full text-left text-sm lg:table">
        <thead>
          <tr className="sticky top-0 border-b border-line bg-surface text-ink-muted">
            <th scope="col" className="py-2 pr-4 font-medium">Store</th>
            <th scope="col" className="py-2 pr-4 font-medium">People</th>
            <th scope="col" className="py-2 pr-4 font-medium">Store Managers</th>
            <th scope="col" className="py-2 pr-4 font-medium">Created</th>
            <th scope="col" className="py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line-subtle">
          {stores.map((s) => (
            <tr key={s.id}>
              <td className="py-2 pr-4 wrap-break-word">
                <Link href={`/admin/stores/${s.id}`} className={`inline-flex min-h-11 items-center ${LINK}`}>
                  {s.name}
                </Link>
              </td>
              <td className="py-2 pr-4 text-ink-muted">{s.people}</td>
              <td className="py-2 pr-4 wrap-break-word text-ink-muted">{managers(s)}</td>
              <td className="py-2 pr-4 whitespace-nowrap text-ink-muted">
                <LocalTime at={s.createdAt} />
              </td>
              <td className="py-2">{s.paused ? <PausedBadge /> : null}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
