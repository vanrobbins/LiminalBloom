// Liminal Bloom's admins, for /admin/admins (spec 0.7.1 7.1): who, who added them and when, and Remove. The last
// admin has no Remove (the server refuses it too, lib/admin/admins.ts). A short list, so rows at every size.

import { ShieldCheck } from "lucide-react";

import { LocalTime } from "@/components/time/local-time";
import type { AdminRow } from "@/lib/admin/admins";

import { RemoveAdmin } from "./admin-people-actions";

export function AdminList({ admins, currentUserId }: { admins: AdminRow[]; currentUserId: string }) {
  return (
    <ul className="flex flex-col divide-y divide-line-subtle">
      {admins.map((a) => (
        <li key={a.userId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="flex flex-wrap items-center gap-2 text-ink">
              <span className="wrap-break-word">{a.name}</span>
              {a.userId === currentUserId ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-line-subtle px-2.5 py-0.5 text-sm font-medium">
                  <ShieldCheck aria-hidden="true" strokeWidth={1.75} className="size-4" />
                  You
                </span>
              ) : null}
            </p>
            <p className="text-sm break-all text-ink-muted">{a.email}</p>
            <p className="text-sm text-ink-muted">
              Added by {a.addedByName} on <LocalTime at={a.createdAt} />
            </p>
          </div>
          {admins.length > 1 ? <RemoveAdmin userId={a.userId} name={a.name} isSelf={a.userId === currentUserId} /> : null}
        </li>
      ))}
    </ul>
  );
}
