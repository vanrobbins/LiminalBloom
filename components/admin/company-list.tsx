// Every company, for /admin/companies (spec 0.7.1 7.3): name, owner, corporate admins, counts, created, paused.
// Rows on a phone and tablet, a table from 1024 px; either way the name opens the company.

import Link from "next/link";

import { PausedBadge } from "@/components/admin/paused-badge";
import { LocalTime } from "@/components/time/local-time";
import type { CompanyRow } from "@/lib/admin/reads-companies";

const LINK = "text-ink underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
const admins = (c: CompanyRow) => (c.corporateAdmins.length > 0 ? c.corporateAdmins.join(", ") : "None");
const counts = (c: CompanyRow) => `${c.regions} ${c.regions === 1 ? "region" : "regions"} · ${c.stores} ${c.stores === 1 ? "store" : "stores"} · ${c.people} ${c.people === 1 ? "person" : "people"}`;

export function CompanyList({ companies }: { companies: CompanyRow[] }) {
  if (companies.length === 0) return <p className="text-ink-muted">There are no companies yet.</p>;
  return (
    <>
      <ul className="flex flex-col divide-y divide-line-subtle lg:hidden">
        {companies.map((c) => (
          <li key={c.id} className="flex flex-col gap-1 py-3">
            <div className="flex items-center gap-2">
              <Link href={`/admin/companies/${c.id}`} className={`min-h-11 min-w-0 flex-1 content-center font-medium wrap-break-word ${LINK}`}>
                {c.name}
              </Link>
              {c.paused ? <PausedBadge /> : null}
            </div>
            <p className="text-sm text-ink-muted wrap-break-word">Owner {c.ownerName} · Corporate admins: {admins(c)}</p>
            <p className="text-sm text-ink-muted">{counts(c)}</p>
            <p className="text-sm text-ink-muted">
              Created <LocalTime at={c.createdAt} />
            </p>
          </li>
        ))}
      </ul>
      <table className="hidden w-full text-left text-sm lg:table">
        <thead>
          <tr className="sticky top-0 border-b border-line bg-surface text-ink-muted">
            <th scope="col" className="py-2 pr-4 font-medium">Company</th>
            <th scope="col" className="py-2 pr-4 font-medium">Owner</th>
            <th scope="col" className="py-2 pr-4 font-medium">Corporate admins</th>
            <th scope="col" className="py-2 pr-4 font-medium">Regions</th>
            <th scope="col" className="py-2 pr-4 font-medium">Stores</th>
            <th scope="col" className="py-2 pr-4 font-medium">People</th>
            <th scope="col" className="py-2 pr-4 font-medium">Created</th>
            <th scope="col" className="py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line-subtle">
          {companies.map((c) => (
            <tr key={c.id}>
              <td className="py-2 pr-4 wrap-break-word">
                <Link href={`/admin/companies/${c.id}`} className={`inline-flex min-h-11 items-center ${LINK}`}>
                  {c.name}
                </Link>
              </td>
              <td className="py-2 pr-4 wrap-break-word text-ink-muted">{c.ownerName}</td>
              <td className="py-2 pr-4 wrap-break-word text-ink-muted">{admins(c)}</td>
              <td className="py-2 pr-4 text-ink-muted">{c.regions}</td>
              <td className="py-2 pr-4 text-ink-muted">{c.stores}</td>
              <td className="py-2 pr-4 text-ink-muted">{c.people}</td>
              <td className="py-2 pr-4 whitespace-nowrap text-ink-muted">
                <LocalTime at={c.createdAt} />
              </td>
              <td className="py-2">{c.paused ? <PausedBadge /> : null}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
